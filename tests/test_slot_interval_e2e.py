"""
QA E2E (Chrome headless via CDP) — "horarios por duración de servicio".

Caso D del plan de validación:
  1. demo.html — flujo de reserva real: elegir "Camuflaje de canas" (20 min),
     parrilla con botones de dos líneas "HH:MM / → HH:MM" (fin = inicio + 20),
     seleccionar hueco 16:45 y verificar resumen "16:45 – 17:05".
  2. admin.html — modal Nueva cita con el mismo formato de botones;
     Configuración → Servicios: campo "Intervalo de reservas (min)" con
     opciones Vacío/5/10/15/30; EN: "Booking interval (min)".

Chrome se controla por DevTools Protocol (websocket-client instalado en el
venv). Se navega y se hacen clics sobre la UI REAL (no HTML mock).

NOTA DE ENTORNO (pre-existente, no de esta feature): el frontend local se
sirve con `python3 -m http.server 5173`, que NO hace proxy de la API
(GET /services desde :5173 -> 404). En producción nginx sirve estáticos y
proxtea /services, /book, /admin/* al backend (same-origin). El código
soporta el hook `window.API_BASE`, así que este driver lo inyecta antes de
cargar la página para emular el same-origin de producción sin tocar el repo.

Requiere: backend :8000 y frontend :5173 levantados.
Run: /home/nx-digital/venv/bin/python -m pytest tests/test_slot_interval_e2e.py -v -s
"""

import base64
import json
import os
import subprocess
import time
from datetime import datetime, timedelta

import pytest
import requests
import websocket

BASE_API = os.environ.get("QA_BASE_URL", "http://localhost:8000")
BASE_WEB = os.environ.get("QA_WEB_URL", "http://localhost:5173")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "test_artifacts", "screenshots")
CDP_PORT = 9444
CHROME = "/usr/bin/google-chrome"


def log(msg: str, ok: bool = None):
    mark = "✅" if ok is True else "❌" if ok is False else "ℹ️"
    print(f"  {mark} {msg}")


# ── CDP mínimo ─────────────────────────────────────────────────────────────
class CDPSession:
    def __init__(self, port: int):
        self.port = port
        self.proc = None
        self.ws = None
        self.msg_id = 0
        self.target_url = None

    def launch(self):
        os.makedirs(SHOTS, exist_ok=True)
        profile = "/tmp/opencode/qa-chrome-profile"
        os.makedirs(profile, exist_ok=True)
        self.proc = subprocess.Popen(
            [
                CHROME,
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--hide-scrollbars",
                "--disable-dev-shm-usage",
                "--window-size=420,1200",
                f"--remote-debugging-port={self.port}",
                "--remote-debugging-address=127.0.0.1",
                f"--user-data-dir={profile}",
                "about:blank",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        # Esperar a que el endpoint de debugging responda
        for _ in range(50):
            try:
                r = requests.get(f"http://127.0.0.1:{self.port}/json/version", timeout=2)
                if r.status_code == 200:
                    return
            except Exception:
                pass
            time.sleep(0.2)
        raise RuntimeError("Chrome CDP no responde en el puerto de debugging")

    def new_page(self, url: str):
        # Chrome >=111 requiere PUT /json/new
        target = None
        for method in (requests.put, requests.get):
            try:
                r = method(f"http://127.0.0.1:{self.port}/json/new?{url}", timeout=5)
                if r.status_code == 200:
                    target = r.json()
                    break
            except Exception:
                continue
        if not target or "webSocketDebuggerUrl" not in target:
            raise RuntimeError(f"No se pudo crear target CDP para {url}")
        self.target_url = url
        self.ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=40)
        self.ws.settimeout(40)
        self.send("Page.enable")
        self.send("Runtime.enable")
        # Emula el same-origin de producción (nginx): el código usa
        # `const API = window.API_BASE || ''`. Se inyecta antes de cualquier script.
        self.send(
            "Page.addScriptToEvaluateOnNewDocument",
            {"source": f"window.API_BASE = {json.dumps(BASE_API)};"},
        )
        self.navigate(url)

    def send(self, method: str, params: dict | None = None) -> dict:
        self.msg_id += 1
        mid = self.msg_id
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        while True:
            raw = self.ws.recv()
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8", "replace")
            data = json.loads(raw)
            if data.get("id") == mid:
                if "error" in data:
                    raise RuntimeError(f"CDP {method} error: {data['error']}")
                return data.get("result", {})

    def navigate(self, url: str):
        self.send("Page.navigate", {"url": url})
        for _ in range(60):
            state = self.evaluate("document.readyState")
            if state == "complete":
                return
            time.sleep(0.25)
        raise RuntimeError(f"timeout cargando {url}")

    def evaluate(self, expr: str):
        res = self.send(
            "Runtime.evaluate",
            {"expression": expr, "awaitPromise": True, "returnByValue": True},
        )
        result = res.get("result", {})
        if result.get("subtype") == "error":
            raise RuntimeError(f"JS error: {result.get('description')}")
        return result.get("value")

    def screenshot(self, name: str) -> str:
        res = self.send("Page.captureScreenshot", {"format": "png"})
        path = os.path.join(SHOTS, name)
        with open(path, "wb") as fh:
            fh.write(base64.b64decode(res["data"]))
        log(f"screenshot: {path}", True)
        return path

    def close(self):
        try:
            if self.ws:
                self.ws.close()
        except Exception:
            pass
        if self.proc:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=5)
            except Exception:
                self.proc.kill()


# JS utilitario: clic con polling (la UI es React, render async).
# El find va envuelto en try/catch para que un error puntual no deje la
# promesa sin resolver (Runtime.evaluate awaitPromise se colgaría).
POLL_CLICK = """
new Promise(res => {
  const t0 = Date.now();
  const iv = setInterval(() => {
    const done = (v) => { clearInterval(iv); res(v); };
    const btns = [...document.querySelectorAll('button')];
    try { %FIND% } catch (e) { /* retry en el siguiente tick */ }
    if (Date.now() - t0 > 12000) done('timeout');
  }, 250);
})
"""


def js_poll_click(find_js: str) -> str:
    return POLL_CLICK.replace("%FIND%", find_js)


@pytest.fixture(scope="module")
def chrome():
    if not os.path.exists(CHROME):
        pytest.skip("Chrome no disponible en /usr/bin/google-chrome")
    try:
        requests.get(BASE_API + "/services", timeout=5)
        requests.get(BASE_WEB + "/demo.html", timeout=5)
    except Exception as e:
        pytest.skip(f"backend/frontend no disponibles: {e}")
    s = CDPSession(CDP_PORT)
    s.launch()
    yield s
    s.close()


@pytest.fixture(scope="module")
def admin_token():
    env_path = os.path.join(ROOT, ".env")
    env = {}
    if os.path.exists(env_path):
        with open(env_path) as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    env[k.strip()] = v.strip()
    user = os.environ.get("ADMIN_USERNAME", env.get("ADMIN_USERNAME", "admin"))
    pwd = os.environ.get("ADMIN_PASSWORD", env.get("ADMIN_PASSWORD", ""))
    if not pwd:
        pytest.skip("ADMIN_PASSWORD no disponible")
    r = requests.post(f"{BASE_API}/admin/login", json={"username": user, "password": pwd}, timeout=10)
    assert r.status_code == 200, f"login admin: {r.status_code}"
    return r.json()["access_token"]


# ── Helpers de dominio ─────────────────────────────────────────────────────
def slot_buttons(cdp) -> list:
    """Extrae los botones de hueco con dos líneas (inicio, fin)."""
    return cdp.evaluate("""
(() => {
  const out = [];
  for (const b of document.querySelectorAll('button')) {
    if (b.children.length < 2) continue;
    const s0 = (b.children[0].textContent || '').trim();
    const s1 = (b.children[1].textContent || '').trim();
    if (/^\\d{2}:\\d{2}$/.test(s0)) out.push({start: s0, end: s1.replace('\\u2192', '').trim(), aria: b.getAttribute('aria-label') || ''});
  }
  return out;
})()
""")


def hhmm_to_min(s: str) -> int:
    h, m = s.split(":")
    return int(h) * 60 + int(m)


# ═══════════════════════════════════════════════════════════════════════════
# D1 — demo.html: flujo de reserva (ES)
# ═══════════════════════════════════════════════════════════════════════════

class TestDemoFlow:
    def test_d1_demo_slots_two_line_grid(self, chrome):
        cdp = chrome
        cdp.new_page(f"{BASE_WEB}/demo.html")
        # Idioma ES forzado (headless Chrome navega en en-US)
        cdp.evaluate("localStorage.setItem('barber_lang','es'); sessionStorage.clear(); 'ok'")
        cdp.navigate(f"{BASE_WEB}/demo.html")

        # 1) Esperar servicios cargados
        wait_ret = cdp.evaluate("""
new Promise(res => {
  const t0 = Date.now();
  const iv = setInterval(() => {
    if (document.body.innerText.includes('Camuflaje de canas')) { clearInterval(iv); res('ok'); }
    else if (Date.now() - t0 > 20000) { clearInterval(iv); res('timeout'); }
  }, 250);
})
""")
        assert wait_ret == "ok", f"demo.html no cargó los servicios (estado: {wait_ret})"
        cdp.screenshot("e2e_demo_01_servicios_ES.png")
        log("demo.html paso 1: lista de servicios renderizada (ES)", True)

        # 2) Clic en "Camuflaje de canas" (ServiceCard, div.cursor-pointer)
        ret = cdp.evaluate(js_poll_click("""
const name = 'Camuflaje de canas';
const h3 = [...document.querySelectorAll('h3')].find(e => (e.textContent || '').trim() === name);
if (h3) {
  let el = h3;
  while (el && el !== document.body && !((el.className || '').toString().includes('cursor-pointer'))) el = el.parentElement;
  if (el && el !== document.body) { el.click(); done('clicked'); }
  else { h3.closest('div').click(); done('clicked-fallback'); }
}
"""))
        log(f"clic en servicio Camuflaje de canas -> {ret}", ret and ret.startswith("clicked"))
        assert ret and ret.startswith("clicked"), "no se pudo hacer clic en el servicio Camuflaje de canas"

        # 3) Día 28 (mañana laborable) en el DaySelector
        ret = cdp.evaluate(js_poll_click("""
const b = btns.find(x => x.children.length === 3 && /(^|\\D)28(\\D|$)/.test(x.textContent) && /oct/i.test(x.textContent));
if (b) { b.click(); done('clicked day 28'); }
"""))
        log(f"clic en día 28 -> {ret}", ret == "clicked day 28")
        assert ret == "clicked day 28", "no se pudo seleccionar el día 28"

        # 4) Esperar parrilla de huecos del 28
        wait_ret = cdp.evaluate("""
new Promise(res => {
  const t0 = Date.now();
  const iv = setInterval(() => {
    const n = [...document.querySelectorAll('button')].filter(b => b.children.length >= 2 && /^\\d{2}:\\d{2}$/.test((b.children[0].textContent||'').trim())).length;
    if (n > 20) { clearInterval(iv); res('ok ' + n); }
    else if (Date.now() - t0 > 20000) { clearInterval(iv); res('timeout n=' + n); }
  }, 250);
})
""")
        assert wait_ret and wait_ret.startswith("ok"), f"parrilla de huecos no cargó: {wait_ret}"
        cdp.screenshot("e2e_demo_02_parrilla_huecos_ES.png")

        slots = slot_buttons(cdp)
        assert len(slots) > 20, f"parrilla inesperadamente vacía: {slots[:5]}"
        log(f"parrilla demo 28-oct: {len(slots)} botones de hueco", True)

        # 5) Dos líneas: fin = inicio + 20 min (Camuflaje de canas)
        bad = []
        for s in slots:
            if hhmm_to_min(s["end"]) != hhmm_to_min(s["start"]) + 20:
                bad.append(s)
        assert not bad, f"botones con fin != inicio+20: {bad[:5]}"
        log("todos los botones muestran 'HH:MM / → HH:MM' con fin = inicio + 20 min", True)

        # 6) El hueco 16:45 → 17:05 está presente y usa template.slot_range en aria-label
        target = next((s for s in slots if s["start"] == "16:45"), None)
        assert target is not None, f"no aparece el hueco 16:45: {[s['start'] for s in slots][:12]}"
        assert target["end"] == "17:05", f"fin de 16:45 inesperado: {target}"
        assert "16:45 – 17:05" in (target["aria"] or ""), f"aria-label sin rango: {target['aria']!r}"
        log("hueco 16:45 / → 17:05 presente; aria-label '16:45 – 17:05'", True)

    def test_d2_demo_slot_summary_range(self, chrome):
        cdp = chrome
        # Clic en el hueco 16:45
        ret = cdp.evaluate(js_poll_click("""
const b = btns.find(x => x.children.length >= 2 && (x.children[0].textContent || '').trim() === '16:45');
if (b) { b.click(); done('clicked 16:45'); }
"""))
        log(f"clic en hueco 16:45 -> {ret}", ret == "clicked 16:45")
        assert ret == "clicked 16:45", "no se pudo hacer clic en el hueco 16:45"

        wait_ret = cdp.evaluate("""
new Promise(res => {
  const t0 = Date.now();
  const iv = setInterval(() => {
    if (document.body.innerText.includes('16:45 – 17:05')) { clearInterval(iv); res('ok'); }
    else if (Date.now() - t0 > 10000) { clearInterval(iv); res('timeout'); }
  }, 200);
})
""")
        assert wait_ret == "ok", "el rango '16:45 – 17:05' no aparece tras seleccionar el hueco"
        cdp.screenshot("e2e_demo_03_hueco_seleccionado_resumen_ES.png")
        text = cdp.evaluate("document.body.innerText")
        assert "16:45 – 17:05" in text, f"el resumen no muestra el rango. Fragmento: {text[:500]}"
        log("resumen del hueco seleccionado muestra el rango '16:45 – 17:05'", True)

        # Continuar al formulario: el resumen "Tu reserva" incluye el rango
        ret = cdp.evaluate(js_poll_click("""
const b = btns.find(x => (x.textContent || '').trim().startsWith('Continuar'));
if (b) { b.click(); done('clicked continuar'); }
"""))
        log(f"clic en Continuar -> {ret}", ret == "clicked continuar")
        assert ret == "clicked continuar", "no se pudo hacer clic en Continuar"
        wait_ret = cdp.evaluate("""
new Promise(res => {
  const t0 = Date.now();
  const iv = setInterval(() => {
    if ((document.body.innerText || '').toLowerCase().includes('tu reserva')) { clearInterval(iv); res('ok'); }
    else if (Date.now() - t0 > 10000) { clearInterval(iv); res('timeout'); }
  }, 200);
})
""")
        assert wait_ret == "ok", "no se llegó al paso de formulario ('Tu reserva')"
        cdp.screenshot("e2e_demo_04_formulario_resumen_ES.png")
        text = cdp.evaluate("document.body.innerText")
        assert "16:45 – 17:05" in text, f"resumen del formulario sin rango: {text[:500]}"
        log("paso formulario: 'Tu reserva' incluye '16:45 – 17:05'", True)


# ═══════════════════════════════════════════════════════════════════════════
# D2 — admin.html: modal Nueva cita + Configuración → Servicios (ES/EN)
# ═══════════════════════════════════════════════════════════════════════════

class TestAdminFlow:
    def _login(self, cdp, token: str, url: str):
        cdp.new_page(f"{BASE_WEB}/admin.html")
        cdp.evaluate(f"""
localStorage.setItem('barber_lang','es');
sessionStorage.setItem('barber_admin_token', {json.dumps(token)});
'ok'
""")
        cdp.navigate(url)

    def test_d3_admin_new_booking_modal_grid(self, chrome, admin_token):
        cdp = chrome
        self._login(cdp, admin_token, f"{BASE_WEB}/admin.html?tab=dashboard")

        # Panel cargado (logueado) — botón "Nueva reserva" del dashboard
        wait_ret = cdp.evaluate("""
new Promise(res => {
  const t0 = Date.now();
  const iv = setInterval(() => {
    if (document.body.innerText.includes('Nueva reserva')) { clearInterval(iv); res('ok'); }
    else if (Date.now() - t0 > 20000) { clearInterval(iv); res('timeout'); }
  }, 250);
})
""")
        assert wait_ret == "ok", f"el panel admin no cargó el dashboard (estado: {wait_ret})"
        cdp.screenshot("e2e_admin_01_dashboard_ES.png")

        ret = cdp.evaluate(js_poll_click("""
const b = btns.find(x => (x.textContent || '').trim().startsWith('Nueva reserva'));
if (b) { b.click(); done('clicked nueva reserva'); }
"""))
        log(f"clic en 'Nueva reserva' -> {ret}", ret == "clicked nueva reserva")
        assert ret == "clicked nueva reserva", "no se encontró el botón Nueva reserva"

        # Modal paso 1: elegir Camuflaje de canas
        ret = cdp.evaluate(js_poll_click("""
const cands = btns.filter(x => (x.textContent || '').trim().startsWith('Camuflaje de canas'));
if (cands.length) {
  cands.sort((a, b) => a.textContent.length - b.textContent.length);
  cands[0].click(); done('clicked camuflaje');
}
"""))
        log(f"clic en servicio Camuflaje de canas (modal) -> {ret}", ret == "clicked camuflaje")
        assert ret == "clicked camuflaje", "no se pudo elegir el servicio en el modal"

        # Día 28 en la tira del modal
        ret = cdp.evaluate(js_poll_click("""
const b = btns.find(x => x.children.length === 3 && /(^|\\D)28(\\D|$)/.test(x.textContent) && /oct/i.test(x.textContent));
if (b) { b.click(); done('clicked day 28'); }
"""))
        log(f"clic en día 28 (modal) -> {ret}", ret == "clicked day 28")
        assert ret == "clicked day 28", "no se pudo seleccionar el día 28 en el modal"

        wait_ret = cdp.evaluate("""
new Promise(res => {
  const t0 = Date.now();
  const iv = setInterval(() => {
    const n = [...document.querySelectorAll('button')].filter(b => b.children.length >= 2 && /^\\d{2}:\\d{2}$/.test((b.children[0].textContent||'').trim())).length;
    if (n > 20) { clearInterval(iv); res('ok ' + n); }
    else if (Date.now() - t0 > 20000) { clearInterval(iv); res('timeout n=' + n); }
  }, 250);
})
""")
        assert wait_ret and wait_ret.startswith("ok"), f"parrilla del modal no cargó: {wait_ret}"
        cdp.screenshot("e2e_admin_02_modal_nueva_cita_huecos_ES.png")

        slots = slot_buttons(cdp)
        assert len(slots) > 20, f"parrilla del modal vacía: {slots[:5]}"
        bad = [s for s in slots if hhmm_to_min(s["end"]) != hhmm_to_min(s["start"]) + 20]
        assert not bad, f"botones modal con fin != inicio+20: {bad[:5]}"
        assert any(s["start"] == "16:45" and s["end"] == "17:05" for s in slots), \
            f"falta hueco 16:45-17:05 en modal: {[s['start'] for s in slots][:12]}"
        log(f"modal Nueva cita: {len(slots)} botones 'HH:MM / → HH:MM' (fin = inicio+20)", True)

    def test_d4_admin_services_slot_interval_field(self, chrome, admin_token):
        cdp = chrome
        self._login(cdp, admin_token, f"{BASE_WEB}/admin.html?tab=settings")

        # Subpestaña Servicios
        ret = cdp.evaluate(js_poll_click("""
const b = btns.find(x => (x.textContent || '').trim() === 'Servicios');
if (b) { b.click(); done('clicked servicios'); }
"""))
        log(f"clic en subpestaña Servicios -> {ret}", ret == "clicked servicios")
        assert ret == "clicked servicios", "no se encontró la subpestaña Servicios"

        # Abrir edición de "Camuflaje de canas"
        ret = cdp.evaluate(js_poll_click("""
const rows = [...document.querySelectorAll('div')]
  .filter(d => (d.textContent || '').includes('Camuflaje de canas') && d.querySelector('button'))
  .sort((a, b) => a.textContent.length - b.textContent.length);
for (const d of rows) {
  const btn = [...d.querySelectorAll('button')].find(b => /Editar|Edit/.test(b.textContent || ''));
  if (btn) { btn.click(); done('clicked editar'); break; }
}
"""))
        log(f"clic en 'Editar servicio' de Camuflaje de canas -> {ret}", ret == "clicked editar")
        assert ret == "clicked editar", "no se encontró el botón Editar servicio de Camuflaje de canas"

        # Campo "Intervalo de reservas (min)" + opciones
        time.sleep(1.5)  # el modal se pinta tras el clic (React)
        field = cdp.evaluate("""
(() => {
  const labels = [...document.querySelectorAll('label')].filter(l => (l.textContent || '').trim() === 'Intervalo de reservas (min)');
  if (!labels.length) return {found: false, body: document.body.innerText.slice(0, 300)};
  const sel = labels[0].parentElement.querySelector('select');
  if (!sel) return {found: true, select: false};
  return {
    found: true, select: true,
    value: sel.value,
    options: [...sel.options].map(o => ({value: o.value, label: o.textContent.trim()})),
    help: (labels[0].parentElement.querySelector('p') || {}).textContent || ''
  };
})()
""")
        assert field.get("found"), f"campo 'Intervalo de reservas (min)' no encontrado: {field}"
        assert field.get("select"), "la etiqueta existe pero no hay <select>"
        values = [o["value"] for o in field["options"]]
        assert values[0] == "", f"la primera opción debería ser Vacío/Automático: {values}"
        assert set(values) >= {"", "5", "10", "15", "30"}, f"opciones inesperadas: {field['options']}"
        log(f"campo Intervalo de reservas: opciones {values} (Vacío/5/10/15/30)", True)
        log(f"opción vacía etiquetada '{field['options'][0]['label']}'; help: {field['help'].strip()!r}", True)
        cdp.screenshot("e2e_admin_03_servicios_intervalo_ES.png")

        # Ayuda ES (registro de copy — se valida contenido útil)
        assert "Vacío" in field["help"] or "autom" in field["help"].lower(), f"help sin texto útil: {field['help']!r}"

    def test_d5_admin_services_slot_interval_en(self, chrome, admin_token):
        cdp = chrome
        # Empezar desde un estado conocido (logueado, sin modales)
        self._login(cdp, admin_token, f"{BASE_WEB}/admin.html?tab=settings")
        # Botón de idioma EN (aria-label 'Switch to English') en el header admin
        ret = cdp.evaluate(js_poll_click("""
const b = btns.find(x => (x.getAttribute('aria-label') || '') === 'Switch to English');
if (b) { b.click(); done('clicked EN'); }
"""))
        log(f"clic en switch idioma EN -> {ret}", ret == "clicked EN")
        assert ret == "clicked EN", "no se encontró el switch de idioma EN"
        # El botón hace location.reload(); esperar recarga
        time.sleep(3)
        cdp.navigate(f"{BASE_WEB}/admin.html?tab=settings")

        ret = cdp.evaluate(js_poll_click("""
const b = btns.find(x => (x.textContent || '').trim() === 'Services');
if (b) { b.click(); done('clicked services'); }
"""))
        log(f"clic en subpestaña Services (EN) -> {ret}", ret == "clicked services")
        assert ret == "clicked services", "no se encontró la subpestaña Services (EN)"

        ret = cdp.evaluate(js_poll_click("""
const rows = [...document.querySelectorAll('div')]
  .filter(d => (d.textContent || '').includes('Camuflaje de canas') && d.querySelector('button'))
  .sort((a, b) => a.textContent.length - b.textContent.length);
for (const d of rows) {
  const btn = [...d.querySelectorAll('button')].find(b => /Edit/.test(b.textContent || ''));
  if (btn) { btn.click(); done('clicked edit'); break; }
}
"""))
        log(f"clic en 'Edit service' (EN) -> {ret}", ret == "clicked edit")
        assert ret == "clicked edit", "no se encontró el botón Edit service (EN)"

        time.sleep(1.5)  # el modal se pinta tras el clic (React)
        field = cdp.evaluate("""
(() => {
  const labels = [...document.querySelectorAll('label')].filter(l => (l.textContent || '').trim() === 'Booking interval (min)');
  if (!labels.length) return {found: false, body: document.body.innerText.slice(0, 300)};
  const sel = labels[0].parentElement.querySelector('select');
  return {
    found: true,
    options: sel ? [...sel.options].map(o => ({value: o.value, label: o.textContent.trim()})) : [],
    help: (labels[0].parentElement.querySelector('p') || {}).textContent || '',
    autoLabel: sel ? [...sel.options].map(o => o.textContent.trim())[0] : null
  };
})()
""")
        assert field.get("found"), f"texto EN 'Booking interval (min)' no encontrado: {field}"
        values = [o["value"] for o in field["options"]]
        assert set(values) >= {"", "5", "10", "15", "30"}, f"opciones EN inesperadas: {field['options']}"
        log("EN: label 'Booking interval (min)' presente con opciones Vacío/5/10/15/30", True)
        log(f"EN: opción vacía '{field['autoLabel']}'; help: {field['help'].strip()!r}", True)
        cdp.screenshot("e2e_admin_04_servicios_intervalo_EN.png")

        # Restaurar idioma ES para no dejar la sesión en EN
        cdp.evaluate("localStorage.setItem('barber_lang','es'); 'ok'")
