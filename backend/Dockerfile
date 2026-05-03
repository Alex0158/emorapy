# 使用與 backend/package.json engines 對齊的 Node.js 版本
FROM node:24-alpine

# 安裝 OpenSSL 和其他必要的系統依賴（Prisma 需要）
# openssl: OpenSSL 庫
# libc6-compat: 兼容性庫
RUN apk add --no-cache openssl libc6-compat

# 設置工作目錄
WORKDIR /app

# 複製package文件
COPY package*.json ./
COPY prisma ./prisma/

# 安裝所有依賴（包括 devDependencies，用於構建）
# 忽略 postinstall，避免在源碼尚未 COPY 前提前觸發 build
RUN npm ci --ignore-scripts

# 生成Prisma Client
RUN npx prisma generate

# 複製源代碼
COPY . .

# Railway production service uses /backend as the Docker build context. Keep
# the type-only contracts dependency available without requiring repo-root files.
RUN mkdir -p ../packages/contracts/types && \
    cp src/types/contracts/*.d.ts ../packages/contracts/types/

# 構建TypeScript（生產環境，不生成 sourcemap）
RUN npx tsc --project tsconfig.prod.json

# 清理 devDependencies（可選，減小鏡像大小）
# 注意：保留 prisma 以便運行遷移
RUN npm prune --production --no-save prisma @prisma/client

# 暴露端口
EXPOSE 3000

# 啟動應用
CMD ["npm", "start"]
