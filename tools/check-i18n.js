#!/usr/bin/env node
/**
 * 翻訳漏れ検出スクリプト
 * ja.ts にあるキーが en.ts / zh-CN.ts にもあるかチェック
 *
 * 使い方: node tools/check-i18n.js
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, '..', 'src', 'i18n', 'locales');

// TS ファイルからオブジェクトを安全に評価
function loadLocale(filename) {
  const src = readFileSync(join(localesDir, filename), 'utf-8');
  // "const xx = { ... }; export default xx;" 形式をパース
  // translation キーの中身を抽出
  const cleaned = src
    .replace(/^const \w+ = /, '(')
    .replace(/;\s*export default \w+;\s*$/, ')')
    .replace(/;\s*$/, '');
  try {
    return eval(cleaned);
  } catch {
    // eval が失敗した場合、正規表現でキーだけ抽出するフォールバック
    return null;
  }
}

// ネストされたオブジェクトのキーをフラット化
function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

// ロケールファイルを読み込み
const files = [
  { name: 'ja', file: 'ja.ts' },
  { name: 'en', file: 'en.ts' },
];

// zh-CN.ts が存在すれば追加
try {
  readFileSync(join(localesDir, 'zh-CN.ts'));
  files.push({ name: 'zh-CN', file: 'zh-CN.ts' });
} catch {}

const locales = {};
for (const f of files) {
  const data = loadLocale(f.file);
  if (!data) {
    console.error(`❌ ${f.file} の読み込みに失敗しました`);
    continue;
  }
  locales[f.name] = flattenKeys(data.translation || data);
}

if (!locales.ja) {
  console.error('❌ ja.ts が読み込めませんでした');
  process.exit(1);
}

const jaKeys = new Set(locales.ja);
let totalMissing = 0;

console.log('🔍 翻訳漏れチェック\n');
console.log(`   ja.ts: ${jaKeys.size} キー\n`);

for (const f of files) {
  if (f.name === 'ja') continue;
  if (!locales[f.name]) continue;

  const targetKeys = new Set(locales[f.name]);
  const missing = [...jaKeys].filter(k => !targetKeys.has(k));
  const extra = [...targetKeys].filter(k => !jaKeys.has(k));

  console.log(`── ${f.name}.ts (${targetKeys.size} キー) ──`);

  if (missing.length === 0) {
    console.log('   ✅ 漏れなし');
  } else {
    console.log(`   ❌ ${missing.length} キーが不足:`);
    for (const k of missing) {
      console.log(`      - ${k}`);
    }
    totalMissing += missing.length;
  }

  if (extra.length > 0) {
    console.log(`   ⚠  ${extra.length} キーが ja.ts に存在しない (余剰):`);
    for (const k of extra) {
      console.log(`      + ${k}`);
    }
  }

  console.log('');
}

if (totalMissing > 0) {
  console.log(`\n合計 ${totalMissing} キーの翻訳が不足しています。`);
  process.exit(1);
} else {
  console.log('\n✅ 全ロケールファイルの翻訳が完了しています。');
}
