#!/bin/bash
# 本地 CI 驗證：後端單元測試 + 後端/前端構建（不含 lint，lint 在 GitHub Actions 執行）
# 用於快速確認 build 與 test 可通過

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▶ 後端單元測試..."
cd backend
NODE_ENV=test SKIP_DB_INIT=true JWT_SECRET=test-secret-min-16-chars OPENAI_API_KEY=sk-dev-test DATABASE_URL=file:./test.db npm run test:unit
cd "$ROOT"

echo "▶ 後端構建..."
cd backend
npm run build
cd "$ROOT"

echo "▶ 前端單元測試..."
cd frontend
npm run test:run
cd "$ROOT"

echo "▶ 前端構建..."
cd frontend
npm run build
cd "$ROOT"

echo "✅ 本地 CI 驗證通過（後端 test:unit + 前端 test:run + 兩端 build）"
