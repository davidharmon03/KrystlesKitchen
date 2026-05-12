#!/bin/bash
set -e

echo ""
echo "🌿 Krystle's Brand Hub — Setup"
echo "================================"
echo ""

# Check Node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install it from https://nodejs.org (v18+)"
  exit 1
fi

NODE_VERSION=$(node -v | cut -c2- | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 18+ required. You have $(node -v)"
  exit 1
fi

echo "✅ Node $(node -v) detected"
echo ""

# Server deps
echo "📦 Installing server dependencies..."
cd server
npm install
echo "✅ Server deps installed"
echo ""

# Client deps
echo "📦 Installing client dependencies..."
cd ../client
npm install
echo "✅ Client deps installed"
echo ""

# Create uploads dir
mkdir -p ../server/uploads

echo "✅ Setup complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  To run the app, open two terminals:"
echo ""
echo "  Terminal 1 (backend):"
echo "    cd server && npm start"
echo ""
echo "  Terminal 2 (frontend):"
echo "    cd client && npm run dev"
echo ""
echo "  Then open: http://localhost:5173"
echo ""
echo "  Demo login: krystle@example.com / password123"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
