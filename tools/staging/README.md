# CG Staging Directory

Claude Code (with comfyui-mcp) places generated images here for human review.

## Flow

```
Claude Code                          Browser (cg-generator.html)
    │                                        │
    ├─ Generate prompts for each CG          │
    ├─ Send to ComfyUI via MCP               │
    ├─ Save output to staging/<id>.webp      │
    ├─ Write staging/manifest.json           │
    │                                        │
    │   ──── User opens cg-generator.html ────
    │                                        │
    │                                ├─ Click "staging更新"
    │                                ├─ Review generated images
    │                                ├─ Approve → auto-download with correct filename
    │                                ├─ Reject → enter reason
    │                                ├─ Click "FB出力" → feedback.json
    │                                        │
    │   ──── User gives feedback.json to Claude ──
    │                                        │
    ├─ Read staging/feedback.json            │
    ├─ Improve prompts based on feedback     │
    ├─ Regenerate → update manifest.json     │
    └─ ...repeat until all adopted           │
```

## manifest.json format

```json
{
  "items": {
    "shoulder_lean": {
      "image": "shoulder_lean.webp",
      "prompt": "positive prompt used...",
      "negPrompt": "negative prompt used...",
      "seed": 12345
    }
  }
}
```

## feedback.json format (output by the review tool)

```json
{
  "timestamp": "2026-03-04T...",
  "charId": "blaze",
  "items": {
    "shoulder_lean": {
      "file": "shoulder_lean.webp",
      "trigger": "耳元でささやく",
      "status": "review",
      "posPrompt": "current positive prompt...",
      "negPrompt": "current negative prompt...",
      "rejectionReasons": ["構図が違う", "表情をもっと恥ずかしそうに"],
      "adopted": false
    },
    "kiss": {
      "status": "done",
      "adopted": true
    }
  }
}
```

## Claude Code Usage

```bash
# 1. Install comfyui-mcp
claude mcp add comfyui-mcp -- npx -y comfyui-mcp

# 2. In Claude Code session:
#    "blaze のCG一覧を読んで、未作成のCGをComfyUIで生成して staging/ に置いて"

# 3. User reviews in browser, exports feedback

# 4. "staging/feedback.json を読んで、却下されたCGのプロンプトを改善して再生成して"
```
