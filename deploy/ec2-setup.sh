#!/bin/bash
# =============================================================
# EC2 初期セットアップスクリプト
# Amazon Linux 2023 / Ubuntu 22.04+ 対応
#
# 使い方:
#   1. EC2インスタンスを起動 (t3.micro以上推奨)
#   2. セキュリティグループでポート 80, 443, 22 を開放
#   3. SSH接続後、このスクリプトを実行:
#      curl -sSL <raw-url> | bash
#      または: bash ec2-setup.sh
# =============================================================
set -euo pipefail

echo "=== Operation Nightcap - EC2 セットアップ ==="

# --- OS検出 ---
if command -v dnf &>/dev/null; then
    PKG_MGR="dnf"
elif command -v apt-get &>/dev/null; then
    PKG_MGR="apt-get"
else
    echo "サポートされていないOS。Amazon Linux 2023 または Ubuntu を使用してください。"
    exit 1
fi

# --- Docker インストール ---
if ! command -v docker &>/dev/null; then
    echo ">>> Docker をインストール中..."
    if [ "$PKG_MGR" = "dnf" ]; then
        sudo dnf update -y
        sudo dnf install -y docker git
        sudo systemctl start docker
        sudo systemctl enable docker
    else
        sudo apt-get update
        sudo apt-get install -y ca-certificates curl gnupg
        sudo install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        sudo chmod a+r /etc/apt/keyrings/docker.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin git
        sudo systemctl start docker
        sudo systemctl enable docker
    fi
    sudo usermod -aG docker "$USER"
    echo "Docker インストール完了"
fi

# --- Docker Compose インストール (Amazon Linux) ---
if [ "$PKG_MGR" = "dnf" ] && ! docker compose version &>/dev/null 2>&1; then
    echo ">>> Docker Compose プラグインをインストール中..."
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | sed 's/.*"v\(.*\)".*/\1/')
    sudo curl -SL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    echo "Docker Compose インストール完了"
fi

echo ""
echo "=== セットアップ完了！ ==="
echo ""
echo "次のステップ:"
echo "  1. リポジトリをクローン:"
echo "     git clone <your-repo-url> ~/app && cd ~/app"
echo ""
echo "  2. アプリを起動:"
echo "     docker compose up -d --build"
echo ""
echo "  3. ブラウザで確認:"
echo "     http://<EC2のパブリックIP>"
echo ""
echo "便利コマンド:"
echo "  docker compose logs -f    # ログ確認"
echo "  docker compose down       # 停止"
echo "  docker compose up -d --build  # 再ビルド&起動"
echo ""
echo "※ docker グループの反映には再ログインが必要な場合があります:"
echo "   exit して再度 SSH 接続してください"
