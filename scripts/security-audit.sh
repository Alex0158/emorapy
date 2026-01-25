#!/bin/bash

# 安全審查自動化腳本
# 用於快速執行安全檢查

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔒 開始安全審查..."
echo ""

# 檢查計數器
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

# 檢查函數
check_item() {
  local name=$1
  local command=$2
  local expected=${3:-0}

  echo -n "檢查: $name ... "

  if eval "$command" > /dev/null 2>&1; then
    if [ $? -eq $expected ]; then
      echo -e "${GREEN}✅ 通過${NC}"
      ((CHECKS_PASSED++))
      return 0
    else
      echo -e "${YELLOW}⚠️  警告${NC}"
      ((WARNINGS++))
      return 1
    fi
  else
    echo -e "${RED}❌ 失敗${NC}"
    ((CHECKS_FAILED++))
    return 1
  fi
}

# 1. 檢查 .env 文件是否在 .gitignore 中
echo "📋 1. 環境變量安全檢查"
if grep -q "^\.env$" .gitignore 2>/dev/null || grep -q "^\.env\*" .gitignore 2>/dev/null; then
  echo -e "${GREEN}✅ .env 文件在 .gitignore 中${NC}"
  ((CHECKS_PASSED++))
else
  echo -e "${RED}❌ .env 文件不在 .gitignore 中${NC}"
  ((CHECKS_FAILED++))
fi

# 檢查是否有實際的 .env 文件被提交
if git ls-files | grep -q "\.env$" 2>/dev/null; then
  echo -e "${RED}❌ 發現 .env 文件被提交到版本控制${NC}"
  ((CHECKS_FAILED++))
else
  echo -e "${GREEN}✅ 沒有 .env 文件被提交${NC}"
  ((CHECKS_PASSED++))
fi
echo ""

# 2. 檢查硬編碼的敏感信息
echo "📋 2. 代碼安全檢查"
echo "檢查硬編碼的敏感信息..."

# 檢查後端
if grep -r "sk-[a-zA-Z0-9]" backend/src --exclude-dir=node_modules 2>/dev/null | grep -v "example\|test\|TODO"; then
  echo -e "${RED}❌ 發現硬編碼的API Key${NC}"
  ((CHECKS_FAILED++))
else
  echo -e "${GREEN}✅ 沒有發現硬編碼的API Key${NC}"
  ((CHECKS_PASSED++))
fi

# 檢查前端
if grep -r "sk-[a-zA-Z0-9]" frontend/src --exclude-dir=node_modules 2>/dev/null | grep -v "example\|test\|TODO"; then
  echo -e "${RED}❌ 發現硬編碼的API Key${NC}"
  ((CHECKS_FAILED++))
else
  echo -e "${GREEN}✅ 沒有發現硬編碼的API Key${NC}"
  ((CHECKS_PASSED++))
fi
echo ""

# 3. 依賴安全掃描
echo "📋 3. 依賴安全掃描"
echo "檢查後端依賴..."

if [ -d "backend" ] && [ -f "backend/package.json" ]; then
  cd backend
  if [ -d "node_modules" ]; then
    AUDIT_RESULT=$(npm audit --json 2>/dev/null || echo '{"vulnerabilities":{}}')
    HIGH_VULN=$(echo "$AUDIT_RESULT" | grep -o '"high":[0-9]*' | grep -o '[0-9]*' || echo "0")
    CRITICAL_VULN=$(echo "$AUDIT_RESULT" | grep -o '"critical":[0-9]*' | grep -o '[0-9]*' || echo "0")
    
    if [ "$CRITICAL_VULN" -gt 0 ]; then
      echo -e "${RED}❌ 發現 $CRITICAL_VULN 個嚴重漏洞${NC}"
      ((CHECKS_FAILED++))
    elif [ "$HIGH_VULN" -gt 0 ]; then
      echo -e "${YELLOW}⚠️  發現 $HIGH_VULN 個高危漏洞${NC}"
      ((WARNINGS++))
    else
      echo -e "${GREEN}✅ 沒有發現嚴重或高危漏洞${NC}"
      ((CHECKS_PASSED++))
    fi
  else
    echo -e "${YELLOW}⚠️  node_modules 不存在，請先運行 npm install${NC}"
    ((WARNINGS++))
  fi
  cd ..
else
  echo -e "${YELLOW}⚠️  後端目錄不存在${NC}"
  ((WARNINGS++))
fi

echo "檢查前端依賴..."
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
  cd frontend
  if [ -d "node_modules" ]; then
    AUDIT_RESULT=$(npm audit --json 2>/dev/null || echo '{"vulnerabilities":{}}')
    HIGH_VULN=$(echo "$AUDIT_RESULT" | grep -o '"high":[0-9]*' | grep -o '[0-9]*' || echo "0")
    CRITICAL_VULN=$(echo "$AUDIT_RESULT" | grep -o '"critical":[0-9]*' | grep -o '[0-9]*' || echo "0")
    
    if [ "$CRITICAL_VULN" -gt 0 ]; then
      echo -e "${RED}❌ 發現 $CRITICAL_VULN 個嚴重漏洞${NC}"
      ((CHECKS_FAILED++))
    elif [ "$HIGH_VULN" -gt 0 ]; then
      echo -e "${YELLOW}⚠️  發現 $HIGH_VULN 個高危漏洞${NC}"
      ((WARNINGS++))
    else
      echo -e "${GREEN}✅ 沒有發現嚴重或高危漏洞${NC}"
      ((CHECKS_PASSED++))
    fi
  else
    echo -e "${YELLOW}⚠️  node_modules 不存在，請先運行 npm install${NC}"
    ((WARNINGS++))
  fi
  cd ..
else
  echo -e "${YELLOW}⚠️  前端目錄不存在${NC}"
  ((WARNINGS++))
fi
echo ""

# 4. 檢查安全頭配置
echo "📋 4. 安全配置檢查"
if grep -q "helmet" backend/src/app.ts 2>/dev/null; then
  echo -e "${GREEN}✅ Helmet 安全頭已配置${NC}"
  ((CHECKS_PASSED++))
else
  echo -e "${RED}❌ Helmet 安全頭未配置${NC}"
  ((CHECKS_FAILED++))
fi

if grep -q "cors" backend/src/app.ts 2>/dev/null; then
  echo -e "${GREEN}✅ CORS 已配置${NC}"
  ((CHECKS_PASSED++))
else
  echo -e "${RED}❌ CORS 未配置${NC}"
  ((CHECKS_FAILED++))
fi
echo ""

# 總結
echo "================================"
echo "安全審查總結"
echo "================================"
echo -e "${GREEN}通過: $CHECKS_PASSED${NC}"
echo -e "${YELLOW}警告: $WARNINGS${NC}"
echo -e "${RED}失敗: $CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
  if [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 所有安全檢查通過！${NC}"
    exit 0
  else
    echo -e "${YELLOW}⚠️  有警告項目，建議處理${NC}"
    exit 0
  fi
else
  echo -e "${RED}❌ 有安全問題需要修復${NC}"
  exit 1
fi



