/**
 * アプリケーション設定
 *
 * VITE_ASSET_CDN: 画像等の静的アセットのベースURL
 *   - 開発時: 空文字 (ローカルのpublicフォルダを使用)
 *   - 本番 (EC2のみ): 空文字 (Nginxから配信)
 *   - 本番 (S3+CDN): "https://assets.example.com" のようなCDN URL
 */
export const ASSET_BASE_URL = import.meta.env.VITE_ASSET_CDN ?? '';

/**
 * アセットパスにCDNベースURLを付与する
 * @example assetUrl('/characters/blaze/portrait.webp')
 *   開発時 → '/characters/blaze/portrait.webp'
 *   本番時 → 'https://assets.example.com/characters/blaze/portrait.webp'
 */
export function assetUrl(path: string): string {
  return `${ASSET_BASE_URL}${path}`;
}
