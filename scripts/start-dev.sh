#!/bin/bash

# 開發環境啟動腳本（同時啟動前後端）

echo "🚀 啟動開發環境..."

# 檢查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安裝，請先安裝Node.js"
    exit 1
fi

# 創建日誌目錄
mkdir -p logs

# 啟動後端（後台運行）
echo "📦 啟動後端服務..."
cd backend
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# 等待後端啟動
sleep 3

# 啟動前端（後台運行）
echo "🌐 啟動前端服務..."
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ 開發環境已啟動！"
echo "📊 後端: http://localhost:3000"
echo "🌐 前端: http://localhost:5173"
echo ""
echo "📝 日誌文件:"
echo "   - logs/backend.log"
echo "   - logs/frontend.log"
echo ""
echo "按 Ctrl+C 停止服務"

# 等待中斷信號
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM

# 保持運行
wait

