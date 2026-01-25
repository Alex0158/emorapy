#!/bin/bash

echo "============================================================"
echo "升級 Node.js 腳本"
echo "============================================================"
echo ""

# 檢查當前版本
CURRENT_VERSION=$(node --version)
echo "當前 Node.js 版本: $CURRENT_VERSION"
echo ""

# 方法 1: 使用 nvm
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    echo "📦 使用 nvm 升級 Node.js..."
    source "$HOME/.nvm/nvm.sh"
    
    # 安裝 Node.js 22
    echo "正在安裝 Node.js 22..."
    nvm install 22
    nvm use 22
    nvm alias default 22
    
    NEW_VERSION=$(node --version)
    echo ""
    echo "✅ Node.js 已升級到: $NEW_VERSION"
    exit 0
fi

# 方法 2: 使用 Homebrew
if command -v brew >/dev/null 2>&1; then
    echo "📦 使用 Homebrew 升級 Node.js..."
    brew upgrade node
    
    NEW_VERSION=$(node --version)
    echo ""
    echo "✅ Node.js 已升級到: $NEW_VERSION"
    exit 0
fi

# 方法 3: 手動安裝提示
echo "❌ 未找到 nvm 或 Homebrew"
echo ""
echo "請選擇以下方法之一升級 Node.js:"
echo ""
echo "方法 1: 安裝 nvm（推薦）"
echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
echo "  source ~/.zshrc  # 或 source ~/.bashrc"
echo "  nvm install 22"
echo "  nvm use 22"
echo ""
echo "方法 2: 使用 Homebrew"
echo "  brew install node"
echo ""
echo "方法 3: 從官網下載"
echo "  訪問 https://nodejs.org/"
echo "  下載並安裝最新 LTS 版本"
echo ""
exit 1
