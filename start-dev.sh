#!/bin/bash

# 開發服務器快速啟動腳本
# 用途：同時啟動後端和前端開發服務器

echo "============================================================"
echo "🚀 啟動開發服務器"
echo "============================================================"
echo ""

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 錯誤: 未找到 Node.js，請先安裝 Node.js"
    exit 1
fi

# 檢查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 錯誤: 未找到 npm，請先安裝 npm"
    exit 1
fi

# 獲取腳本所在目錄
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 檢查後端目錄
if [ ! -d "backend" ]; then
    echo "❌ 錯誤: 未找到 backend 目錄"
    exit 1
fi

# 檢查前端目錄
if [ ! -d "frontend" ]; then
    echo "❌ 錯誤: 未找到 frontend 目錄"
    exit 1
fi

# 檢查後端依賴
if [ ! -d "backend/node_modules" ]; then
    echo "⚠️  後端依賴未安裝，正在安裝..."
    cd backend
    npm install
    cd ..
fi

# 檢查前端依賴
if [ ! -d "frontend/node_modules" ]; then
    echo "⚠️  前端依賴未安裝，正在安裝..."
    cd frontend
    npm install
    cd ..
fi

echo "✅ 依賴檢查完成"
echo ""

# 清理函數
cleanup() {
    echo ""
    echo "============================================================"
    echo "🛑 正在停止服務器..."
    echo "============================================================"
    
    # 殺死後端進程
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "✅ 後端服務已停止"
    fi
    
    # 殺死前端進程
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo "✅ 前端服務已停止"
    fi
    
    # 殺死所有相關進程（備用方案）
    pkill -f "vite" 2>/dev/null
    pkill -f "ts-node" 2>/dev/null
    pkill -f "nodemon" 2>/dev/null
    
    echo ""
    echo "============================================================"
    echo "✅ 所有服務已停止"
    echo "============================================================"
    exit 0
}

# 註冊清理函數
trap cleanup INT TERM

# 啟動後端
echo "📦 啟動後端服務..."
BACKEND_PORT="${PORT:-3001}"
cd backend
PORT="$BACKEND_PORT" npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# 等待後端啟動
echo "⏳ 等待後端啟動..."
sleep 5

# 檢查後端是否啟動成功
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ 後端啟動失敗，請檢查日誌: /tmp/backend.log"
    cat /tmp/backend.log
    exit 1
fi

echo "✅ 後端服務已啟動 (PID: $BACKEND_PID)"
echo ""

# 啟動前端（使用 Node.js 22）
echo "📦 啟動前端服務..."
cd frontend

# 加載 nvm 並使用 Node.js 22
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || echo "⚠️  警告: 無法切換到 Node.js 22，請手動運行: nvm use 22"

npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# 等待前端啟動
echo "⏳ 等待前端啟動..."
sleep 3

# 檢查前端是否啟動成功
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ 前端啟動失敗，請檢查日誌: /tmp/frontend.log"
    cat /tmp/frontend.log
    cleanup
    exit 1
fi

echo "✅ 前端服務已啟動 (PID: $FRONTEND_PID)"
echo ""

# 顯示服務信息
echo "============================================================"
echo "✅ 開發服務器已啟動"
echo "============================================================"
echo ""
echo "📋 服務信息:"
echo "   🔹 後端: http://localhost:${BACKEND_PORT:-3001}"
echo "   🔹 前端: http://localhost:5173"
echo "   🔹 健康檢查: http://localhost:${BACKEND_PORT:-3001}/health"
echo ""
echo "📝 日誌位置:"
echo "   🔹 後端日誌: /tmp/backend.log"
echo "   🔹 前端日誌: /tmp/frontend.log"
echo ""
echo "💡 提示:"
echo "   - 在瀏覽器中打開 http://localhost:5173 查看前端"
echo "   - 按 Ctrl+C 停止所有服務"
echo "   - 修改代碼後會自動熱重載"
echo ""
echo "============================================================"
echo ""

# 嘗試自動打開瀏覽器（Mac）
if [[ "$OSTYPE" == "darwin"* ]]; then
    sleep 2
    echo "🌐 正在打開瀏覽器..."
    open http://localhost:5173 2>/dev/null || true
fi

# 等待用戶中斷
echo "⏳ 服務運行中，按 Ctrl+C 停止..."
echo ""

# 顯示實時日誌（可選）
tail -f /tmp/backend.log /tmp/frontend.log 2>/dev/null &
TAIL_PID=$!

# 等待進程結束
wait $BACKEND_PID $FRONTEND_PID

# 清理
cleanup
