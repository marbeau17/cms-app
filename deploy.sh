#!/usr/bin/env bash
# ============================================================
# CMS v1.2.0 - Vercel Deployment Script
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

command -v vercel >/dev/null 2>&1 || error "Vercel CLI not found. Install: npm install -g vercel"

info "CMS v1.2.0 — Deploying to Vercel"
echo ""

# Build frontend first to verify it compiles
info "Step 1/2: Building frontend..."
cd "$(dirname "$0")/frontend"
npm install --silent
npm run build
cd ..
info "Frontend build OK."
echo ""

# Deploy to Vercel
info "Step 2/2: Deploying to Vercel..."
vercel --prod
echo ""

info "Deployment complete!"
echo ""
warn "Make sure environment variables are set in Vercel Dashboard:"
echo "  Settings > Environment Variables"
echo "  - FTP_HOST"
echo "  - FTP_USER"
echo "  - FTP_PASS"
echo "  - FTP_BASE_PATH"
echo "  - BANANA_API_KEY"
echo "  - BANANA_API_URL"
echo "  - CSRF_SECRET"
echo "  - CORS_ORIGINS"
