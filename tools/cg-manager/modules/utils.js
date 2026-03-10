// ============================================================
// Utility Functions
// ============================================================

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (type || 'ok');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = 'toast', 2500);
}

function findLastIndex(arr, pred) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}
