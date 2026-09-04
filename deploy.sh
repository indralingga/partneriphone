#!/bin/bash
# ============================================================
# DEPLOY SCRIPT — iPhone Partner & Profit Management System
# VPS: Ubuntu / Debian
# Port: 3390
# ============================================================

set -e

APP_NAME="partner-iphone"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "=================================================="
echo "  📱 Deploy iPhone Partner Hub ke VPS             "
echo "=================================================="
echo ""

# 1. Update package list & build essentials (dibutuhkan better-sqlite3)
echo "📦 [1/6] Memeriksa Build Tools (C++ compiler)..."
sudo apt-get update -y
sudo apt-get install -y build-essential python3 curl git

# 2. Periksa / Install Node.js 20 LTS
echo "📦 [2/6] Memeriksa Node.js..."
if command -v node &> /dev/null; then
    echo "   ✅ Node.js sudah terpasang: $(node -v)"
else
    echo "   Memasang Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "   ✅ Node.js $(node -v) berhasil dipasang"
fi

# 3. Periksa / Install PM2
echo "📦 [3/6] Memeriksa PM2..."
if command -v pm2 &> /dev/null; then
    echo "   ✅ PM2 sudah terpasang"
else
    sudo npm install -g pm2
    echo "   ✅ PM2 berhasil dipasang"
fi

# 4. Siapkan file .env jika belum ada
echo "⚙️  [4/6] Menyiapkan environment (.env)..."
if [ ! -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    echo "   ✅ File .env dibuat dari .env.example (Port: 3390, PIN: 1234)"
    echo "   💡 Anda bisa mengedit PIN dengan: nano .env"
fi

# 5. Install Dependencies
echo "📦 [5/6] Menginstal dependensi aplikasi..."
cd "$APP_DIR"
npm install --production

# 6. Menjalankan aplikasi dengan PM2
echo "🚀 [6/6] Menjalankan aplikasi dengan PM2..."
pm2 stop "$APP_NAME" 2>/dev/null || true
pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start server.js --name "$APP_NAME" --cwd "$APP_DIR"
pm2 save

echo ""
echo "=================================================="
echo "  ✅ APLIKASI BERHASIL DIJALANKAN DI PORT 3390!"
echo "=================================================="
echo ""
echo "Cek status aplikasi:"
echo "  pm2 status"
echo "  pm2 logs $APP_NAME"
echo ""
echo "Untuk menghubungkan ke Domain / Nginx:"
echo "  1. Edit domain di nginx.conf: nano nginx.conf"
echo "  2. Salin ke Nginx:"
echo "     sudo cp nginx.conf /etc/nginx/sites-available/$APP_NAME"
echo "     sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/"
echo "     sudo nginx -t && sudo systemctl reload nginx"
echo "  3. Aktifkan SSL (HTTPS gratis):"
echo "     sudo certbot --nginx"
echo "=================================================="
