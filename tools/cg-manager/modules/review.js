// ============================================================
// Review – Adopt / Reject / WebP Conversion
// ============================================================

function convertToWebP(srcUrl, quality = 0.90) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('WebP変換失敗')); return; }
        const url = URL.createObjectURL(blob);
        const origSize = srcUrl.startsWith('data:') ? Math.round((srcUrl.length - srcUrl.indexOf(',') - 1) * 3 / 4) : 0;
        resolve({ url, blob, origSize, webpSize: blob.size });
      }, 'image/webp', quality);
    };
    img.onerror = () => reject(new Error('画像読み込み失敗'));
    img.src = srcUrl;
  });
}

async function adopt() {
  const item = items.find(i => i.id === selectedId);
  if (!item || !item.history.length) return;
  const img = document.querySelector('#imgPreview img');
  const srcUrl = img ? img.src : item.history[item.history.length - 1].url;
  for (const h of item.history) h.adopted = (h.url === srcUrl);
  item.adoptedImage = srcUrl;
  item.status = 'done';

  const webpFile = item.id + '.webp';
  try {
    const result = await convertToWebP(srcUrl);
    item.file = webpFile;

    if (projectDirHandle) {
      await saveToFolder(result.blob, item);
      URL.revokeObjectURL(result.url);
      const kb = (result.webpSize / 1024).toFixed(0);
      const subPath = item.type === 'cg' ? `cg/${webpFile}` : webpFile;
      const pctStr = result.origSize > 0 ? (() => { const pct = Math.round((1 - result.webpSize / result.origSize) * 100); return `, ${pct > 0 ? '-' + pct : '+' + Math.abs(pct)}%`; })() : '';
      toast(`「${item.trigger}」→ ${subPath} (${kb}KB${pctStr})`, 'ok');
    } else {
      const a = document.createElement('a');
      a.href = result.url; a.download = webpFile;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(result.url);
      const kb = (result.webpSize / 1024).toFixed(0);
      const pctStr = result.origSize > 0 ? (() => { const pct = Math.round((1 - result.webpSize / result.origSize) * 100); return ` (${pct > 0 ? '-' + pct : '+' + Math.abs(pct)}%)`; })() : '';
      toast(`「${item.trigger}」採用 → WebP ${kb}KB${pctStr}`, 'ok');
    }
  } catch (err) {
    const a = document.createElement('a');
    a.href = srcUrl; a.download = item.file;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast(`「${item.trigger}」採用（WebP変換失敗、元形式）`, 'info');
  }

  saveAll(); updateCounts(); selectItem(item.id);
  checkAllFiles();

  const next = items.find(i => i.status === 'pending');
  if (next) setTimeout(() => selectItem(next.id), 300);
}

function reject() {
  document.getElementById('rejectModal').classList.remove('hidden');
  document.getElementById('rejectReason').value = '';
}

function qr(text) {
  const ta = document.getElementById('rejectReason');
  if (ta.value) ta.value += '、';
  ta.value += text;
}

function closeReject() {
  document.getElementById('rejectModal').classList.add('hidden');
}

function doReject() {
  const item = items.find(i => i.id === selectedId);
  if (!item) return;
  const reason = document.getElementById('rejectReason').value.trim();
  const selThumb = document.querySelector('#histStrip .hist-thumb.sel img');
  const viewingUrl = selThumb ? selThumb.src : (item.history.length > 0 ? item.history[item.history.length - 1].url : null);
  const viewIdx = viewingUrl ? item.history.findIndex(h => h.url === viewingUrl) : item.history.length - 1;
  const removeIdx = viewIdx >= 0 ? viewIdx : item.history.length - 1;
  if (reason) item.feedback.push({ reason, ts: new Date().toISOString(), idx: removeIdx });
  if (item.history.length > 1) { item.history.splice(removeIdx, 1); item.status = 'review'; }
  else { item.history = []; item.status = 'pending'; }
  closeReject();
  saveAll(); updateCounts(); selectItem(item.id);
  toast(reason ? `却下: ${reason}` : '却下', 'info');
}
