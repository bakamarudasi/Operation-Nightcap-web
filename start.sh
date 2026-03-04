#!/bin/bash
# ============================================
# Operation Nightcap - CG Editor Launcher
# HTML エディタ + Claude Code を同時起動
# ============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EDITOR_PATH="$SCRIPT_DIR/tools/cg-inventory-editor.html"

echo "🎮 Operation Nightcap - CG Editor 起動中..."
echo ""

# --- HTMLをブラウザで開く ---
if command -v open &>/dev/null; then
  # macOS
  open "$EDITOR_PATH"
elif command -v xdg-open &>/dev/null; then
  # Linux
  xdg-open "$EDITOR_PATH" &
elif command -v wslview &>/dev/null; then
  # WSL
  wslview "$EDITOR_PATH" &
fi

echo "✅ CG Inventory Editor を開きました"
echo ""

# --- Claude Code を起動 ---
if command -v claude &>/dev/null; then
  echo "🤖 Claude Code 起動中..."
  echo "   プロジェクト: $SCRIPT_DIR"
  echo ""
  cd "$SCRIPT_DIR"
  claude
else
  echo "⚠ Claude Code が見つかりません"
  echo "  インストール: npm install -g @anthropic-ai/claude-code"
  echo ""
  echo "  Claude Code なしで続行します。"
  echo "  HTMLエディタのみ使用できます。"
fi
