#!/usr/bin/env python3
"""
import-booksy-clients.py — Importa clientes desde Booksy (CSV) a Código de Caballeros

USO:
  1. Exporta tus clientes desde Booksy como CSV
     (Booksy → Clientes → Exportar → CSV)
  2. Guarda el archivo como clientes-booksy.csv
  3. Ejecuta este script:
      
      python3 import-booksy-clients.py clientes-booksy.csv

  4. También puedes pasar la URL de la API:
      
      python3 import-booksy-clients.py clientes-booksy.csv https://codigodecaballeros.site

FORMATO CSV ESPERADO:
  El script detecta automáticamente columnas con nombres como:
  - Nombre / Name / Client name
  - Teléfono / Phone / Mobile / Celular
  - Email / Correo / E-mail

  Si tu exportación de Booksy tiene otro formato, pasa --formato:
  python3 import-booksy-clients.py clientes.csv --formato "nombre,telefono,email"

API:
  Por defecto apunta a https://codigodecaballeros.site
  Autenticación: JWT (Bearer token obtenido de POST /admin/login)
"""

import csv
import json
import sys
import os
import urllib.request
import urllib.error

# ── Configuración ──
API_BASE = "https://codigodecaballeros.site"
ADMIN_USER = "admin"
ADMIN_PASS = "CONTRASENA_REEMPLAZADA_ROTACION_20260627"

# Sinónimos de columnas en español/inglés
COL_NOMBRE = ["nombre", "name", "client name", "cliente", "full name", "nombre completo"]
COL_TELEFONO = ["teléfono", "telefono", "phone", "mobile", "celular", "móvil", "phone number", "tel"]
COL_EMAIL = ["email", "e-mail", "correo", "mail", "e mail"]


def detectar_columnas(headers):
    """Detecta qué columna es nombre, teléfono, email."""
    cols = {"name": None, "phone": None, "email": None}
    h_lower = [h.strip().lower() for h in headers]
    
    for i, h in enumerate(h_lower):
        if h in COL_NOMBRE and cols["name"] is None:
            cols["name"] = i
        elif h in COL_TELEFONO and cols["phone"] is None:
            cols["phone"] = i
        elif h in COL_EMAIL and cols["email"] is None:
            cols["email"] = i
    
    return cols


def leer_csv(archivo, formato=None):
    """Lee el CSV y devuelve lista de dicts con name, phone, email."""
    clientes = []
    
    with open(archivo, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        headers = next(reader)
        
        if formato:
            # Formato personalizado: "nombre,telefono,email"
            keys = [k.strip() for k in formato.split(",")]
            cols = {"name": None, "phone": None, "email": None}
            for i, h in enumerate(headers):
                h_lower = h.strip().lower()
                for k, v in [("name", COL_NOMBRE), ("phone", COL_TELEFONO), ("email", COL_EMAIL)]:
                    if h_lower in v:
                        cols[k] = i
                        break
        else:
            cols = detectar_columnas(headers)
        
        if cols["name"] is None or cols["phone"] is None:
            print(f"❌ No se pudieron detectar las columnas.")
            print(f"   Columnas encontradas: {headers}")
            print(f"   Nombre → columna {cols['name']}")
            print(f"   Teléfono → columna {cols['phone']}")
            print(f"   Email → columna {cols['email']}")
            print("")
            print("💡 Usa --formato para indicar las columnas:")
            print(f"   python3 import-booksy-clients.py {archivo} --formato \"nombre,telefono,email\"")
            sys.exit(1)
        
        for row in reader:
            if not row or not row[0].strip():
                continue
            name = row[cols["name"]].strip() if cols["name"] is not None and cols["name"] < len(row) else ""
            phone = row[cols["phone"]].strip() if cols["phone"] is not None and cols["phone"] < len(row) else ""
            email = row[cols["email"]].strip() if cols["email"] is not None and cols["email"] < len(row) else ""
            
            if name and phone:
                clientes.append({
                    "name": name,
                    "phone": phone,
                    "email": email if email else None,
                })
    
    return clientes


def obtener_jwt(api_base):
    """Obtiene un JWT token del endpoint /admin/login."""
    url = f"{api_base}/admin/login"
    payload = json.dumps({"username": ADMIN_USER, "password": ADMIN_PASS}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            return data["access_token"]
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"❌ Error al obtener JWT: HTTP {e.code}: {body}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error al obtener JWT: {e}")
        sys.exit(1)


def importar(clientes, api_base, token):
    """Envía los clientes al endpoint de importación."""
    url = f"{api_base}/admin/clients/import"
    
    payload = json.dumps({"clients": clientes}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode())
            return result
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"❌ Error HTTP {e.code}: {body}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


def main():
    global API_BASE
    
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)
    
    archivo = sys.argv[1]
    
    if not os.path.exists(archivo):
        print(f"❌ No se encuentra el archivo: {archivo}")
        sys.exit(1)
    
    # URL opcional
    formato = None
    for i, arg in enumerate(sys.argv[2:], 2):
        if arg == "--formato" and i + 1 < len(sys.argv):
            formato = sys.argv[i + 1]
        elif arg.startswith("http"):
            API_BASE = arg
    
    print(f"📂 Leyendo: {archivo}")
    clientes = leer_csv(archivo, formato)
    print(f"✅ {len(clientes)} clientes leídos del CSV")
    
    if len(clientes) == 0:
        print("⚠️ No hay clientes para importar")
        sys.exit(0)
    
    # Vista previa
    print(f"\n📋 Vista previa (primeros 3):")
    for c in clientes[:3]:
        print(f"   · {c['name']:25s} {c['phone']:15s} {c['email'] or '':25s}")
    if len(clientes) > 3:
        print(f"   ... y {len(clientes) - 3} más")
    
    # Obtener JWT token
    print(f"\n🔑 Obteniendo token JWT desde {API_BASE} ...")
    token = obtener_jwt(API_BASE)
    print(f"✅ Token JWT obtenido correctamente")
    
    print(f"\n🚀 Importando a {API_BASE} ...")
    result = importar(clientes, API_BASE, token)
    
    print(f"\n✅ Importación completada:")
    print(f"   • Creados:   {result['created']}")
    print(f"   • Actualizados: {result['updated']}")
    print(f"   • Omitidos:  {result['skipped']}")
    print(f"   • Total:     {result['total']}")
    
    if result['created'] > 0 or result['updated'] > 0:
        print(f"\n👉 Abre el panel para verlos: {API_BASE}/admin.html")


if __name__ == "__main__":
    main()
