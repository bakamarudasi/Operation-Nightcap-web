#!/bin/bash
# ============================================
# CG画像 欠損チェックスクリプト
# マニフェストに記載された画像が存在するか確認する
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

missing=0
found=0
total=0

check_character() {
  local char_dir="$1"
  local char_name
  char_name="$(basename "$char_dir")"
  local manifest="$PROJECT_ROOT/tools/manifests/${char_name}.txt"

  if [ ! -f "$manifest" ]; then
    echo "⚠ マニフェストが見つかりません: $manifest"
    return
  fi

  echo "=== $char_name ==="

  while IFS='|' read -r filename rest; do
    # コメント行・空行をスキップ
    filename="$(echo "$filename" | xargs)"
    [[ -z "$filename" || "$filename" == \#* ]] && continue

    total=$((total + 1))

    # cg/ 配下かそれ以外かをファイル名で判定
    if [[ "$filename" == *.webp || "$filename" == *.png || "$filename" == *.jpg ]]; then
      # CGイベント画像は cg/ 配下
      if [[ "$filename" != portrait* && "$filename" != select-icon* ]]; then
        filepath="$char_dir/cg/$filename"
      else
        filepath="$char_dir/$filename"
      fi

      if [ -f "$filepath" ]; then
        echo "  ✓ $filename"
        found=$((found + 1))
      else
        echo "  ✗ $filename  ← 画像がありません"
        missing=$((missing + 1))
      fi
    fi
  done < "$manifest"

  echo ""
}

echo ""
echo "CG画像 欠損チェック"
echo "==============================="
echo ""

# 全キャラクターディレクトリを走査
for char_dir in "$PROJECT_ROOT"/public/characters/*/; do
  [ -d "$char_dir" ] && check_character "$char_dir"
done

echo "==============================="
echo "合計: $total 枚  |  存在: $found 枚  |  不足: $missing 枚"
echo "==============================="

if [ "$missing" -gt 0 ]; then
  echo ""
  echo "⚠ ${missing}枚の画像が不足しています"
  exit 1
else
  echo ""
  echo "✓ すべての画像が揃っています"
  exit 0
fi
