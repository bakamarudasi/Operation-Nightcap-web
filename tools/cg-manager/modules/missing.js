// ============================================================
// Missing CG List Export (for ComfyUI / Claude)
// ============================================================

function setMissingFmt(fmt) {
  missingCGFormat = fmt;
  document.getElementById('fmtJson').className = fmt === 'json' ? 'primary' : '';
  document.getElementById('fmtMd').className = fmt === 'md' ? 'primary' : '';
  renderMissingCGOutput();
}

function getMissingCGData() {
  const info = getCharInfo(currentCharId);
  const data = loadCharData(currentCharId) || {};
  const charName = data.charName || info?.name || '';
  const charNameEn = data.charNameEn || info?.nameEn || currentCharId.toUpperCase();

  const missingCGs = items.filter(i => i.type === 'cg' && i.status !== 'done');
  const missingPortraits = items.filter(i => i.type === 'portrait' && i.status !== 'done');

  const cgEntries = missingCGs.map(cg => {
    const cardInfo = cardNameCache[cg.triggerCard] || cg.trigger || cg.triggerCard;
    return {
      id: cg.gameId || `${currentCharId}_${cg.id}`,
      filename: cg.file,
      path: `public/characters/${currentCharId}/cg/${cg.file}`,
      triggerCard: cg.triggerCard,
      triggerName: cardInfo,
      requiredDrunkLevel: parseInt(cg.level?.replace('Lv.', '') || '0'),
      cgColor: cg.cgColor || '#e85d3a',
      instantWin: cg.instantWin || false,
      isReverse: cg.note === 'reverse_harassment',
      dialogue: (cg.dialogue || []).map((d, i) => ({
        line: i + 1,
        speaker: d.speaker || '(ナレーション)',
        text: d.text
      })),
      frames: (cg.frames || []).map((f, i) => ({
        frame: i + 1,
        label: f.label || '',
        dialogueStart: f.dialogueStart || 0,
        transition: f.transition || 'fade',
        imagePath: f.src || `public/characters/${currentCharId}/cg/${cg.triggerCard}_${i + 1}.webp`
      }))
    };
  });

  const portraitEntries = missingPortraits.map(p => {
    const drunkLevel = p.id === 'portrait' ? -1 : parseInt(p.id.replace('portrait-drunk-', ''));
    const costumeInfo = drunkLevel >= 0 ? info?.costumeStates?.find(cs => cs.level === drunkLevel) : null;
    return {
      id: p.id,
      filename: p.file,
      path: `public/characters/${currentCharId}/${p.file}`,
      trigger: p.trigger,
      drunkLevel: p.level || 'Lv.0',
      costumeDescription: costumeInfo?.description || ''
    };
  });

  const afterEntries = (info?.afterEvents || []).map(ae => ({
    id: ae.id,
    title: ae.title || '',
    requiredCGRate: ae.requiredCGRate,
    requiredWins: ae.requiredWins,
    cgColor: ae.cgColor || '#e85d3a',
    dialogue: (ae.dialogue || []).map((d, i) => ({
      line: i + 1,
      speaker: d.speaker || '(ナレーション)',
      text: d.text
    }))
  }));

  return {
    character: {
      id: currentCharId,
      name: charName,
      nameEn: charNameEn,
      themeColor: info?.theme?.color || '#e85d3a'
    },
    summary: {
      totalCGs: items.filter(i => i.type === 'cg').length,
      missingCGs: missingCGs.length,
      totalPortraits: items.filter(i => i.type === 'portrait').length,
      missingPortraits: missingPortraits.length,
      doneCGs: items.filter(i => i.type === 'cg' && i.status === 'done').length,
    },
    costumeStates: (info?.costumeStates || []).map(cs => ({
      level: cs.level,
      label: cs.label,
      description: cs.description,
      dishevelAmount: cs.dishevelAmount
    })),
    missingCGEvents: cgEntries,
    missingPortraits: portraitEntries,
    afterEvents: afterEntries,
  };
}

function generateMissingJSON(data) {
  const d = data || getMissingCGData();
  return JSON.stringify(d, null, 2);
}

function generateMissingMD(data) {
  const d = data || getMissingCGData();
  let md = '';
  md += `# 不足CGリスト: ${d.character.nameEn} (${d.character.name})\n\n`;
  md += `- キャラID: \`${d.character.id}\`\n`;
  md += `- テーマカラー: \`${d.character.themeColor}\`\n`;
  md += `- CG進捗: ${d.summary.doneCGs}/${d.summary.totalCGs} 完了 / 不足 ${d.summary.missingCGs}枚\n`;
  md += `- 立ち絵進捗: 不足 ${d.summary.missingPortraits}枚\n\n`;

  if (d.costumeStates.length > 0) {
    md += `## 衣装状態 (酔い段階)\n\n`;
    md += `| Lv | ラベル | 描写 | 乱れ度 |\n`;
    md += `|----|--------|------|--------|\n`;
    for (const cs of d.costumeStates) {
      md += `| ${cs.level} | ${cs.label} | ${cs.description} | ${cs.dishevelAmount} |\n`;
    }
    md += '\n';
  }

  if (d.missingCGEvents.length > 0) {
    md += `## 不足CGイベント (${d.missingCGEvents.length}枚)\n\n`;
    for (const cg of d.missingCGEvents) {
      md += `### ${cg.triggerName} (\`${cg.triggerCard}\`)\n\n`;
      md += `- ファイル: \`${cg.path}\`\n`;
      md += `- 酔いLv: ${cg.requiredDrunkLevel}\n`;
      md += `- CGカラー: \`${cg.cgColor}\`\n`;
      if (cg.instantWin) md += `- **即勝利 (instantWin)**\n`;
      if (cg.isReverse) md += `- **逆セクハラ (相手→プレイヤー)**\n`;
      md += '\n';

      if (cg.dialogue.length > 0) {
        md += `**セリフ:**\n\n`;
        for (const dl of cg.dialogue) {
          const speaker = dl.speaker === '(ナレーション)' ? '(ナレ)' : dl.speaker;
          md += `${dl.line}. **${speaker}**: ${dl.text}\n`;
        }
        md += '\n';
      }

      if (cg.frames.length > 0) {
        md += `**フレーム構成:**\n\n`;
        for (const fr of cg.frames) {
          md += `- Frame ${fr.frame}: ${fr.label} (セリフ${fr.dialogueStart + 1}行目〜, transition: ${fr.transition})\n`;
        }
        md += '\n';
      }
      md += '---\n\n';
    }
  }

  if (d.missingPortraits.length > 0) {
    md += `## 不足立ち絵 (${d.missingPortraits.length}枚)\n\n`;
    for (const p of d.missingPortraits) {
      md += `### ${p.trigger} (${p.drunkLevel})\n\n`;
      md += `- ファイル: \`${p.path}\`\n`;
      if (p.costumeDescription) md += `- 衣装描写: ${p.costumeDescription}\n`;
      md += '\n';
    }
  }

  if (d.afterEvents.length > 0) {
    md += `## アフターイベント (${d.afterEvents.length}件)\n\n`;
    for (const ae of d.afterEvents) {
      md += `### ${ae.title} (\`${ae.id}\`)\n\n`;
      md += `- CG回収率: ${(ae.requiredCGRate * 100).toFixed(0)}%以上\n`;
      md += `- 勝利回数: ${ae.requiredWins}回以上\n`;
      md += `- CGカラー: \`${ae.cgColor}\`\n\n`;
      if (ae.dialogue.length > 0) {
        md += `**セリフ:**\n\n`;
        for (const dl of ae.dialogue) {
          const speaker = dl.speaker === '(ナレーション)' ? '(ナレ)' : dl.speaker;
          md += `${dl.line}. **${speaker}**: ${dl.text}\n`;
        }
        md += '\n';
      }
      md += '---\n\n';
    }
  }

  return md;
}

function renderMissingCGOutput() {
  const d = getMissingCGData();
  const output = missingCGFormat === 'json'
    ? JSON.stringify(d, null, 2)
    : generateMissingMD(d);
  document.getElementById('missingCGOutput').value = output;
  document.getElementById('missingStats').textContent =
    `不足CG: ${d.summary.missingCGs}枚 / 不足立ち絵: ${d.summary.missingPortraits}枚`;
}

function showMissingCGModal() {
  renderMissingCGOutput();
  document.getElementById('missingCGModal').classList.remove('hidden');
}

function copyMissingCG() {
  const text = document.getElementById('missingCGOutput').value;
  navigator.clipboard.writeText(text)
    .then(() => toast('コピーしました', 'ok'))
    .catch(() => toast('コピー失敗', 'err'));
}

function downloadMissingCG() {
  const ext = missingCGFormat === 'json' ? 'json' : 'md';
  const mime = missingCGFormat === 'json' ? 'application/json' : 'text/markdown';
  const text = document.getElementById('missingCGOutput').value;
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${currentCharId}_missing_cg_list.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`${ext.toUpperCase()}をダウンロードしました`, 'ok');
}
