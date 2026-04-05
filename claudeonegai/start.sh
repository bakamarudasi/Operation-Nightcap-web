#!/bin/bash
# ============================================================
# Operation Nightcap — エージェントシステム起動
# 
# Claude Code のサブエージェントシステムを使った全自動開発
# 
# 構造:
#   manager (opus) ← 全体指揮・タスク分割
#     ├── researcher (sonnet) ← Web検索でベストプラクティス調査
#     ├── implementer (opus)  ← コード実装
#     └── reviewer (sonnet)   ← ビルド確認・レビュー
#
# 使い方:
#   ./start.sh                           # マネージャー対話モード
#   ./start.sh "ヴィルトゥオーサ追加して" # 指示を渡して放置
#   ./start.sh "リファクタリングして"     # リファクタ自動実行
#   ./start.sh "不足CG生成して"           # CG生成
# ============================================================

set -euo pipefail

PROJECT_DIR="$HOME/Operation-Nightcap-web"
cd "$PROJECT_DIR"

# ── 前提チェック ──
if ! command -v claude &> /dev/null; then
  echo "❌ Claude Code がインストールされていません"
  echo "   npm install -g @anthropic-ai/claude-code"
  exit 1
fi

# ── エージェントファイル確認 ──
if [ ! -d ".claude/agents" ]; then
  echo "❌ .claude/agents/ が見つかりません"
  echo "   プロジェクトにエージェントファイルをコピーしてください"
  exit 1
fi

AGENTS=$(ls .claude/agents/*.md 2>/dev/null | wc -l)
echo "🎻 Operation Nightcap — エージェントシステム"
echo "   エージェント: ${AGENTS}体検出"
echo "   マネージャー: nightcap-manager (opus)"
echo ""

# ── ブランチ作成 ──
BRANCH="auto/$(date +%Y%m%d-%H%M%S)"
git checkout -b "$BRANCH" 2>/dev/null || true
echo "📌 ブランチ: $BRANCH"
echo ""

# ── 起動 ──
if [ $# -gt 0 ]; then
  # パイプモード: 指示を渡して自動実行
  PROMPT="$*

以下の手順で作業してくれ:
1. まず CLAUDE.md を読んでプロジェクトの現状を把握
2. 必要に応じて VIRTUOSA_IMPL.md, VIRTUOSA_RP.md, docs/RETROSPECTIVE.md も読む
3. nightcap-researcher に事前調査を依頼（Web検索でベストプラクティスを調べる）
4. researcher の結果を元に nightcap-implementer に実装を指示
5. nightcap-reviewer にビルド確認を依頼
6. OKなら git add -A && git commit
7. CLAUDE.md のチェックリストを更新
8. 次のタスクへ進む（未完了タスクがあれば）

各ステップでサブエージェントを使い分けること。自分では直接コードを書かない。"

  echo "📋 指示: $*"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  echo "$PROMPT" | claude \
    --agent nightcap-manager \
    --dangerously-skip-permissions \
    --max-turns 80

else
  # 対話モード
  echo "💬 対話モードで起動します"
  echo "   例: 「ヴィルトゥオーサ追加して」"
  echo "   例: 「gameStore分割して」"
  echo "   例: 「不足CG一覧出して」"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  claude \
    --agent nightcap-manager \
    --dangerously-skip-permissions
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏁 完了。コミットログ:"
git log --oneline -10
echo ""
echo "確認: npm run dev"
echo "マージ: git checkout main && git merge $BRANCH"
