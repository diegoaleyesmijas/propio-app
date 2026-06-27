#!/usr/bin/env bash
# seed-test-data.sh — Puebla la BD con datos de prueba realistas
# Uso: bash seed-test-data.sh [URL]
#   URL: https://codigodecaballeros.site (prod, por defecto)
#        http://localhost:8000 (dev local)

BASE="${1:-https://codigodecaballeros.site}"
TODAY=$(date +%Y-%m-%d)

echo "🌱 Sembrando datos de prueba en $BASE"
echo ""

# ── Obtener JWT token ──
get_jwt() {
  curl -s -X POST "$BASE/admin/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"CONTRASENA_REEMPLAZADA_ROTACION_20260627"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])"
}
JWT=$(get_jwt)
AUTH="Authorization: Bearer $JWT"

# ── Helper: crear una reserva y devolver ID ──
book() {
  local name="$1" phone="$2" email="$3" service_id="$4" start_time="$5" is_first="$6"
  curl -s -X POST "$BASE/admin/appointments" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "{
      \"service_id\": $service_id,
      \"customer_name\": \"$name\",
      \"customer_phone\": \"$phone\",
      \"customer_email\": \"$email\",
      \"start_time\": \"${TODAY}T${start_time}:00+00:00\",
      \"is_first_time\": $is_first,
      \"is_demo\": true
    }"
}

# ── Helper: cambiar estado de una reserva ──
complete() {
  local id="$1"
  curl -s -X PATCH "$BASE/admin/appointments/$id/status" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d '{"status":"completed"}' > /dev/null
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📅 Hoy: $TODAY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Reservas para HOY ──
echo "=== 🟡 Creando reservas para hoy ==="

book "Carlos García"     "+34 612 345 001" "carlos@email.com"     1 "10:00" "true"  > /dev/null && echo "  ✅ Corte · Carlos (nuevo)"
book "María López"       "+34 612 345 002" "maria@email.com"      2 "10:30" "false" > /dev/null && echo "  ✅ Barba · María"
book "Juan Martínez"     "+34 612 345 003" "juan@email.com"       3 "11:00" "false" > /dev/null && echo "  ✅ Corte+Barba · Juan"
book "Ana Rodríguez"     "+34 612 345 004" "ana@email.com"        4 "11:30" "true"  > /dev/null && echo "  ✅ Tintura · Ana (nueva)"
book "Pedro Sánchez"     "+34 612 345 005" "pedro@email.com"      1 "12:00" "false" > /dev/null && echo "  ✅ Corte · Pedro"
book "Laura Fernández"   "+34 612 345 006" "laura@email.com"      3 "16:00" "true"  > /dev/null && echo "  ✅ Corte+Barba · Laura (nueva)"
book "Diego Martínez"    "+34 612 345 007" "diego@email.com"      1 "16:30" "false" > /dev/null && echo "  ✅ Corte · Diego"
book "Roberto Ruiz"      "+34 612 345 008" "roberto@email.com"    2 "17:00" "false" > /dev/null && echo "  ✅ Barba · Roberto"

echo ""

# ── Crear algunas para MAÑANA ──
TOMORROW=$(date -d "$TODAY + 1 day" +%Y-%m-%d 2>/dev/null || date -j -v+1d +%Y-%m-%d 2>/dev/null)
if [ -n "$TOMORROW" ]; then
  echo "=== 📅 Creando reservas para mañana ($TOMORROW) ==="

  book_mañana() {
    local name="$1" phone="$2" email="$3" service_id="$4" hour="$5" is_first="$6"
    curl -s -X POST "$BASE/admin/appointments" \
      -H "Content-Type: application/json" \
      -H "$AUTH" \
      -d "{
        \"service_id\": $service_id,
        \"customer_name\": \"$name\",
        \"customer_phone\": \"$phone\",
        \"customer_email\": \"$email\",
        \"start_time\": \"${TOMORROW}T${hour}:00+00:00\",
        \"is_first_time\": $is_first,
        \"is_demo\": true
      }" > /dev/null
  }

  book_mañana "Elena Castro"   "+34 612 345 010" "elena@email.com"   1 "09:00" "true"  && echo "  ✅ Corte · Elena (nueva)"
  book_mañana "David Torres"   "+34 612 345 011" "david@email.com"   3 "09:30" "false" && echo "  ✅ Corte+Barba · David"
  book_mañana "Sonia Vidal"    "+34 612 345 012" "sonia@email.com"   2 "10:30" "false" && echo "  ✅ Barba · Sonia"
fi

echo ""
echo "=== 📊 Resumen de hoy ==="
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -H "$AUTH" "$BASE/admin/summary?date=$TODAY" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
apps = d.get('appointments',[])
total = len(apps)
booked = sum(1 for a in apps if a['status']=='booked')
completed = sum(1 for a in apps if a['status']=='completed')
rev = sum(a.get('service_price',0) for a in apps if a['status']!='cancelled')
print(f'  📅 Total:  {total} citas')
print(f'  🟡 Pendientes: {booked}')
print(f'  ✅ Completadas: {completed}')
print(f'  💰 Ingresos:   {rev}€')
print(f'  👥 Clientes:   {len(set(a[\"customer_name\"] for a in apps))}')
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Datos de prueba creados correctamente"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📌 URLs para testear:"
echo ""
echo "  🌐 PANEL ADMIN (barbero)"
echo "     → $BASE/admin.html"
echo "     → Usuario: admin  /  Contraseña: CONTRASENA_REEMPLAZADA_ROTACION_20260627"
echo ""
echo "  📋 RESERVAS PÚBLICO (clientes)"
echo "     → $BASE/"
echo ""
echo "  📊 DASHBOAD (ingresos mensuales)"
echo "     → $BASE/admin.html  → pestaña Dashboard"
echo ""
echo "  📚 DOCS API"
echo "     → $BASE/docs"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 Comandos rápidos para testear desde terminal:"
echo ""
echo "  # Ver servicios:"
echo "  curl -s $BASE/services | python3 -m json.tool"
echo ""
echo "  # Ver slots disponibles para Corte hoy:"
echo "  curl -s \"$BASE/available-slots?service_id=1&date=$TODAY\""
echo ""
echo "  # Obtener token JWT primero:"
echo "  JWT=\$(curl -s -X POST \"\$BASE/admin/login\" -H \"Content-Type: application/json\" -d '{\"username\":\"admin\",\"password\":\"CONTRASENA_REEMPLAZADA_ROTACION_20260627\"}' | python3 -c \"import sys,json; print(json.load(sys.stdin)['access_token'])\")"
echo "  AUTH=\"Authorization: Bearer \$JWT\""
echo ""
echo "  # Ver resumen de hoy (admin):"
echo "  curl -s -H \"\$AUTH\" \"\$BASE/admin/summary?date=\$TODAY\" | python3 -m json.tool"
echo ""
echo "  # Ver todos los clientes:"
echo "  curl -s -H \"\$AUTH\" \"\$BASE/admin/clients\" | python3 -m json.tool | head -30"
echo ""
echo "  # Ver dashboard mensual:"
echo "  curl -s -H \"\$AUTH\" \"\$BASE/admin/dashboard\" | python3 -m json.tool"
echo ""
echo "  # Exportar clientes a CSV:"
echo "  curl -s -H \"\$AUTH\" \"\$BASE/admin/clients/export\""
echo ""
echo "  # Hacer una reserva desde terminal:"
echo "  curl -s -X POST \"$BASE/book\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"service_id\":1,\"customer_name\":\"Test\",\"customer_phone\":\"+34 600 000 000\",\"start_time\":\"${TODAY}T18:00:00+00:00\"}' | python3 -m json.tool"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
