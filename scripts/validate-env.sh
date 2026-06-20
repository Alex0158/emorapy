#!/bin/bash

# Emorapy - 環境變量驗證腳本
# 用於驗證生產環境變量配置是否完整

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔍 環境變量驗證 - Emorapy"
echo "================================"
echo ""

# 檢查後端環境變量
echo -e "${BLUE}📋 檢查後端環境變量...${NC}"
echo ""

if [ ! -f "backend/.env" ]; then
    echo -e "${RED}❌ 未找到 backend/.env 文件${NC}"
    echo "   請從 backend/.env.example 創建並配置"
    exit 1
fi

# 加載環境變量
set -a
source backend/.env
set +a

# 必需變量列表
REQUIRED_VARS=(
    "DATABASE_URL"
    "JWT_SECRET"
    "OPENAI_API_KEY"
)

# 可選但建議的變量
RECOMMENDED_VARS=(
    "SMTP_HOST"
    "SMTP_PORT"
    "SMTP_USER"
    "SMTP_PASS"
    "FRONTEND_URL"
    "ALLOWED_ORIGINS"
)

# 檢查必需變量
echo "🔴 必需變量："
MISSING_REQUIRED=0
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "  ${RED}❌ ${var} - 未設置${NC}"
        MISSING_REQUIRED=1
    else
        # 隱藏敏感信息
        if [[ "$var" == *"SECRET"* ]] || [[ "$var" == *"KEY"* ]] || [[ "$var" == *"PASSWORD"* ]]; then
            VALUE_PREVIEW="${!var:0:10}..."
            echo -e "  ${GREEN}✅ ${var} - 已設置 (${VALUE_PREVIEW})${NC}"
        else
            echo -e "  ${GREEN}✅ ${var} - 已設置${NC}"
        fi
    fi
done

echo ""

# 檢查建議變量
echo "🟡 建議變量："
MISSING_RECOMMENDED=0
for var in "${RECOMMENDED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "  ${YELLOW}⚠️  ${var} - 未設置（可選）${NC}"
        MISSING_RECOMMENDED=1
    else
        if [[ "$var" == *"SECRET"* ]] || [[ "$var" == *"KEY"* ]] || [[ "$var" == *"PASSWORD"* ]]; then
            VALUE_PREVIEW="${!var:0:10}..."
            echo -e "  ${GREEN}✅ ${var} - 已設置 (${VALUE_PREVIEW})${NC}"
        else
            echo -e "  ${GREEN}✅ ${var} - 已設置${NC}"
        fi
    fi
done

echo ""

# 驗證變量格式
echo "🔍 驗證變量格式..."
echo ""

# 驗證 DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
    if [[ "$DATABASE_URL" == postgresql://* ]]; then
        echo -e "  ${GREEN}✅ DATABASE_URL 格式正確${NC}"
    else
        echo -e "  ${YELLOW}⚠️  DATABASE_URL 格式可能不正確（應以 postgresql:// 開頭）${NC}"
    fi
fi

# 驗證 JWT_SECRET
if [ -n "$JWT_SECRET" ]; then
    LENGTH=${#JWT_SECRET}
    if [ "$LENGTH" -ge 32 ]; then
        echo -e "  ${GREEN}✅ JWT_SECRET 長度足夠 (${LENGTH} 字符)${NC}"
    else
        echo -e "  ${YELLOW}⚠️  JWT_SECRET 長度建議至少32字符（當前: ${LENGTH}）${NC}"
        echo "     生成命令: openssl rand -base64 32"
    fi
fi

# 驗證 OPENAI_API_KEY
if [ -n "$OPENAI_API_KEY" ]; then
    if [[ "$OPENAI_API_KEY" == sk-* ]]; then
        echo -e "  ${GREEN}✅ OPENAI_API_KEY 格式正確${NC}"
    else
        echo -e "  ${YELLOW}⚠️  OPENAI_API_KEY 格式可能不正確（應以 sk- 開頭）${NC}"
    fi
fi

# 驗證端口
if [ -n "$PORT" ]; then
    PORT_NUM=$(echo "$PORT" | tr -d '[:alpha:]')
    if [ "$PORT_NUM" -ge 1 ] && [ "$PORT_NUM" -le 65535 ]; then
        echo -e "  ${GREEN}✅ PORT 範圍正確 (${PORT_NUM})${NC}"
    else
        echo -e "  ${RED}❌ PORT 範圍無效 (應在 1-65535 之間)${NC}"
    fi
fi

echo ""

# 檢查前端環境變量
if [ -d "frontend" ]; then
    echo -e "${BLUE}📋 檢查前端環境變量...${NC}"
    echo ""
    
    if [ ! -f "frontend/.env" ]; then
        echo -e "${YELLOW}⚠️  未找到 frontend/.env 文件${NC}"
        if [ -f "frontend/.env.example" ]; then
            echo "   提示: 可以從 frontend/.env.example 創建並配置"
        fi
    else
        set -a
        source frontend/.env
        set +a
        
        # 檢查必需的前端環境變量
        FRONTEND_REQUIRED_VARS=("VITE_API_BASE_URL")
        FRONTEND_MISSING=0
        
        for var in "${FRONTEND_REQUIRED_VARS[@]}"; do
            if [ -z "${!var}" ]; then
                echo -e "  ${YELLOW}⚠️  ${var} - 未設置（開發環境有默認值）${NC}"
                FRONTEND_MISSING=1
            else
                # 檢查是否為生產環境
                if [ "$NODE_ENV" = "production" ] || [[ "${!var}" == https://* ]]; then
                    # 生產環境驗證 HTTPS
                    if [[ "${!var}" == http://* ]] && [[ "${!var}" != *"localhost"* ]]; then
                        echo -e "  ${YELLOW}⚠️  ${var} - 生產環境建議使用 HTTPS${NC}"
                    else
                        echo -e "  ${GREEN}✅ ${var} - 已設置${NC}"
                    fi
                else
                    echo -e "  ${GREEN}✅ ${var} - 已設置${NC}"
                fi
            fi
        done
    fi
    echo ""
fi

# 檢查環境變量示例文件
echo -e "${BLUE}📋 檢查環境變量示例文件...${NC}"
echo ""

if [ -f "backend/.env.example" ]; then
    echo -e "  ${GREEN}✅ backend/.env.example 存在${NC}"
else
    echo -e "  ${YELLOW}⚠️  backend/.env.example 不存在${NC}"
fi

if [ -f "frontend/.env.example" ]; then
    echo -e "  ${GREEN}✅ frontend/.env.example 存在${NC}"
else
    echo -e "  ${YELLOW}⚠️  frontend/.env.example 不存在${NC}"
fi

echo ""

# 總結
echo "================================"
if [ "$MISSING_REQUIRED" -eq 0 ]; then
    echo -e "${GREEN}✅ 所有必需變量已配置${NC}"
    if [ "$MISSING_RECOMMENDED" -eq 0 ]; then
        echo -e "${GREEN}✅ 所有建議變量已配置${NC}"
        echo -e "${GREEN}🎉 環境變量配置完整！${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  部分建議變量未配置（不影響核心功能）${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ 缺少必需環境變量，請先配置${NC}"
    exit 1
fi
