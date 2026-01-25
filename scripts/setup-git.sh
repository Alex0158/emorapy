#!/bin/bash

# Git 初始化和 GitHub 推送腳本
# 使用前請先閱讀：GitHub推送和Vercel部署指南.md

set -e

echo "🚀 Git 初始化和 GitHub 推送腳本"
echo "=================================="
echo ""

# 檢查是否已經是 Git 倉庫
if [ -d ".git" ]; then
    echo "⚠️  項目已經是 Git 倉庫"
    read -p "是否繼續？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 1. 初始化 Git
echo "📦 步驟 1: 初始化 Git 倉庫..."
git init

# 2. 檢查 .gitignore
echo ""
echo "🔍 步驟 2: 檢查 .gitignore..."
if grep -q "\.env" .gitignore 2>/dev/null; then
    echo "✅ .gitignore 已包含 .env 文件（安全）"
else
    echo "⚠️  警告: .gitignore 可能未包含 .env 文件"
fi

# 3. 添加所有文件
echo ""
echo "📝 步驟 3: 添加文件到 Git..."
git add .

# 4. 檢查是否有敏感文件
echo ""
echo "🔒 步驟 4: 檢查敏感文件..."
if git ls-files | grep -q "\.env$"; then
    echo "⚠️  警告: 發現 .env 文件在暫存區中"
    echo "   建議先移除：git rm --cached backend/.env frontend/.env"
    read -p "是否繼續？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ 未發現 .env 文件在暫存區（安全）"
fi

# 5. 創建初始提交
echo ""
echo "💾 步驟 5: 創建初始提交..."
read -p "提交信息 (默認: Initial commit): " commit_msg
commit_msg=${commit_msg:-"Initial commit: 熊媽媽法庭 MVP"}
git commit -m "$commit_msg"

echo ""
echo "✅ Git 初始化完成！"
echo ""
echo "📋 下一步操作："
echo "1. 在 GitHub 創建新倉庫"
echo "2. 添加遠程倉庫："
echo "   git remote add origin https://github.com/你的用戶名/倉庫名.git"
echo "3. 推送代碼："
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "詳細步驟請參考：GitHub推送和Vercel部署指南.md"

