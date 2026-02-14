@echo off
REM 開發服務器快速啟動腳本 (Windows)
REM 用途：同時啟動後端和前端開發服務器

echo ============================================================
echo 🚀 啟動開發服務器
echo ============================================================
echo.

REM 檢查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 錯誤: 未找到 Node.js，請先安裝 Node.js
    exit /b 1
)

REM 檢查 npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 錯誤: 未找到 npm，請先安裝 npm
    exit /b 1
)

REM 檢查後端目錄
if not exist "backend" (
    echo ❌ 錯誤: 未找到 backend 目錄
    exit /b 1
)

REM 檢查前端目錄
if not exist "frontend" (
    echo ❌ 錯誤: 未找到 frontend 目錄
    exit /b 1
)

REM 檢查後端依賴
if not exist "backend\node_modules" (
    echo ⚠️  後端依賴未安裝，正在安裝...
    cd backend
    call npm install
    cd ..
)

REM 檢查前端依賴
if not exist "frontend\node_modules" (
    echo ⚠️  前端依賴未安裝，正在安裝...
    cd frontend
    call npm install
    cd ..
)

echo ✅ 依賴檢查完成
echo.

REM 啟動後端
echo 📦 啟動後端服務...
start "後端服務" cmd /k "cd backend && npm run dev"

REM 等待後端啟動
echo ⏳ 等待後端啟動...
timeout /t 5 /nobreak >nul

REM 啟動前端
echo 📦 啟動前端服務...
start "前端服務" cmd /k "cd frontend && npm run dev"

REM 等待前端啟動
echo ⏳ 等待前端啟動...
timeout /t 3 /nobreak >nul

echo.
echo ============================================================
echo ✅ 開發服務器已啟動
echo ============================================================
echo.
echo 📋 服務信息:
echo    🔹 後端: http://localhost:3001
echo    🔹 前端: http://localhost:5173
echo    🔹 健康檢查: http://localhost:3001/health
echo.
echo 💡 提示:
echo    - 在瀏覽器中打開 http://localhost:5173 查看前端
echo    - 關閉命令窗口即可停止服務
echo    - 修改代碼後會自動熱重載
echo.
echo ============================================================
echo.

REM 嘗試自動打開瀏覽器
start http://localhost:5173

echo ⏳ 服務運行中，關閉此窗口即可停止所有服務...
pause


