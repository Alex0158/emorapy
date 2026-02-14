#!/bin/bash
# 運行後端 + 前端單元測試
# 後端：必須通過。前端：若依賴已安裝則執行，否則提示執行 ./scripts/fix-frontend-deps.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAILED=0

echo "=== 後端單元測試 ==="
cd "$ROOT/backend"
if [ ! -f "node_modules/.bin/jest" ] && [ ! -f "node_modules/jest/bin/jest.js" ]; then
  echo "⚠️  Jest 未安裝。請執行：cd backend && npm install"
  exit 1
fi
if ! npm run test:unit; then
  FAILED=1
fi

echo ""
echo "=== 前端單元測試 ==="
cd "$ROOT/frontend"
if [ -f "node_modules/.bin/vitest" ] || [ -d "node_modules/vitest" ]; then
  if ! npm run test:run; then
    FAILED=1
  fi
else
  echo "⚠️  Vitest 未安裝，跳過前端測試。"
  echo "    執行 ./scripts/fix-frontend-deps.sh 後再運行本腳本可包含前端測試。"
fi

[ $FAILED -eq 0 ] || exit 1
