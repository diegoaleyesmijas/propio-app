#!/usr/bin/env bash
# ==============================================================
# deploy.sh — Barber Booking MVP · Despliegue en Hostinger VPS
# ==============================================================
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/.../deploy.sh | bash
#   O manual: chmod +x deploy.sh && ./deploy.sh
#
# Requisitos:
#   - VPS con Ubuntu 22.04+ (Hostinger VPS)
#   - Acceso root o sudo
#   - Dominio apuntando a la IP del VPS (opcional para HTTPS)
# ==============================================================

set -euo pipefail
# ⚠️ IMPORTANTE: Edita REPO con la URL real de tu repositorio antes de ejecutar este script.
#    Si no tienes repo Git, deploy.sh NO funcionará (fallará al clonar/actualizar).
#    Alternativa: copia los archivos manualmente con rsync/SCP y omite este script.
REPO="https://github.com/YOUR_USER/barber-booking.git"
BRANCH="main"
INSTALL_DIR="/opt/barber-booking"

echo "╔══════════════════════════════════════════════════════╗"
echo "║  Barber Booking MVP — Deploy Script                 ║"
echo "║  Hostinger VPS                                      ║"
echo "╚══════════════════════════════════════════════════════╝"

# ── 1. Detectar SO ──
if [ ! -f /etc/os-release ]; then
    echo "❌ Solo soportado en Linux (Ubuntu/Debian)"
    exit 1
fi
. /etc/os-release
echo "✓ SO: $ID $VERSION_ID"

# ── 2. Instalar Docker + docker-compose ──
if ! command -v docker &>/dev/null; then
    echo "▶ Instalando Docker..."
    curl -fsSL https://get.docker.com | bash
    sudo usermod -aG docker "$USER"
    echo "✓ Docker instalado. Recomendamos cerrar sesión y volver a entrar."
else
    echo "✓ Docker ya instalado: $(docker --version)"
fi

if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
    echo "▶ Instalando docker-compose..."
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
    echo "✓ docker-compose instalado"
else
    echo "✓ docker-compose ya instalado"
fi

# ── 3. Instalar nginx + certbot (para HTTPS) ──
if ! command -v certbot &>/dev/null; then
    echo "▶ Instalando certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
    echo "✓ certbot instalado"
else
    echo "✓ certbot ya instalado"
fi

# ── 4. Clonar repo ──
if [ ! -d "$INSTALL_DIR" ]; then
    echo "▶ Clonando repositorio..."
    sudo git clone --branch "$BRANCH" "$REPO" "$INSTALL_DIR"
    echo "✓ Repositorio clonado en $INSTALL_DIR"
else
    echo "✓ Repositorio ya existe en $INSTALL_DIR"
    echo "▶ Actualizando..."
    cd "$INSTALL_DIR" && sudo git pull origin "$BRANCH"
fi

# ── 5. Configurar variables de entorno ──
if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo "▶ Creando .env desde .env.example..."
    cd "$INSTALL_DIR"
    # Preguntar valores al usuario
    read -rp "  Dominio (ej: barberia.tudominio.com): " DOMAIN
    read -rsp "  Contraseña PostgreSQL (dejar vacío para 'postgres'): " DB_PASS && echo
    DB_PASS=${DB_PASS:-postgres}
    cat > .env <<EOF
# ── Producción — Barber Booking MVP ──
# Generado por deploy.sh el $(date '+%Y-%m-%d %H:%M')

DB_PASSWORD=${DB_PASS}
FRONTEND_URL=https://${DOMAIN}
ALLOWED_ORIGINS=https://${DOMAIN}
RATE_LIMIT_BOOK=5/minute

# SMTP (opcional — vacío = solo logs en desarrollo)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Código de Caballeros Salon <barberia@${DOMAIN}>"
EOF
    echo "✓ .env creado"
    echo ""
else
    echo "✓ .env ya existe, se reutiliza"
fi

# ── 6. Arrancar servicios ──
echo "▶ Arrancando contenedores..."
cd "$INSTALL_DIR"
sudo docker compose up -d --build
echo "✓ Contenedores levantados"

# ── 7. Configurar HTTPS (si hay dominio) ──
if [ -n "${DOMAIN:-}" ]; then
    echo ""
    echo "▶ ¿Quieres configurar HTTPS con Let's Encrypt ahora? (s/N)"
    read -rp "  → " SETUP_HTTPS
    if [[ "$SETUP_HTTPS" =~ ^[Ss]$ ]]; then
        echo "▶ Configurando HTTPS para $DOMAIN..."
        # Paramos nginx docker momentáneamente y usamos certbot standalone
        sudo docker compose stop nginx
        sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@"$DOMAIN" || {
            echo "⚠️  Certbot falló. Puedes ejecutarlo manualmente:"
            echo "   sudo certbot --nginx -d $DOMAIN"
        }
        # Actualizar nginx.conf con los certificados
        echo "⚠️  IMPORTANTE: Edita nginx/nginx.conf y descomenta el bloque HTTPS"
        echo "   Reemplaza BARBERIA_DOMAIN por $DOMAIN"
        echo "   Luego reinicia: sudo docker compose restart nginx"
        # Volver a arrancar nginx
        sudo docker compose up -d nginx
    fi
fi

# ── 8. Resumen ──
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅ DESPLIEGUE COMPLETADO                           ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Frontend: http://$(curl -s ifconfig.me 2>/dev/null || echo 'IP_DEL_VPS'):80"
echo "║  API Docs: http://$(curl -s ifconfig.me 2>/dev/null || echo 'IP_DEL_VPS'):80/docs"
echo "║  Admin:    http://$(curl -s ifconfig.me 2>/dev/null || echo 'IP_DEL_VPS'):80/admin.html"
echo "║                                                    ║"
echo "║  Para ver logs: sudo docker compose logs -f        ║"
echo "║  Para parar:    sudo docker compose down           ║"
echo "║  Para actualizar: sudo git pull && sudo docker compose up -d --build"
echo "╚══════════════════════════════════════════════════════╝"
