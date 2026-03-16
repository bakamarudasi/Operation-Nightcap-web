#!/bin/bash
# =============================================================
# デプロイスクリプト (EC2上で実行)
#
# 使い方:
#   bash deploy/deploy.sh
#
# git pull → Docker再ビルド → 起動 をワンコマンドで実行
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== Operation Nightcap - デプロイ ==="

echo ">>> 最新コードを取得中..."
git pull

echo ">>> コンテナをビルド&起動中..."
docker compose up -d --build

echo ">>> 古いイメージを削除中..."
docker image prune -f

echo ""
echo "=== デプロイ完了！ ==="
docker compose ps
