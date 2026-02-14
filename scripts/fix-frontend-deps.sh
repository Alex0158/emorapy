#!/bin/bash
# 清理並重新安裝前端依賴（解決 ENOTEMPTY / vitest not found）
# 用法：./scripts/fix-frontend-deps.sh

set -e
cd "$(dirname "$0")/../frontend"

echo "移除 node_modules..."
rm -rf node_modules

echo "重新安裝依賴..."
npm install

echo "完成。可執行：cd frontend && npm run test:run"
