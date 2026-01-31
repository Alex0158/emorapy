#!/bin/bash
# 運行後端單元測試
# 若遇到 jest/ts-jest 未找到，請執行: cd backend && rm -rf node_modules && npm install

set -e
cd "$(dirname "$0")/../backend"

if [ ! -f "node_modules/jest/bin/jest.js" ] && [ ! -f "node_modules/.bin/jest" ]; then
  echo "⚠️  Jest 未正確安裝。請執行："
  echo "   cd backend && rm -rf node_modules && npm install"
  exit 1
fi

npm run test:unit
