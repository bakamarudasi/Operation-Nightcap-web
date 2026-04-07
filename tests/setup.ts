import { vi } from 'vitest';

// i18n はブラウザAPI（document/localStorage）に依存しているため、
// ユニットテストではモック化して副作用を回避する。
vi.mock('../src/i18n/index.ts', () => {
  const t = (key: string, opts?: Record<string, unknown>) => {
    if (opts && typeof opts === 'object' && 'defaultValue' in opts) {
      return String((opts as { defaultValue: unknown }).defaultValue);
    }
    return key;
  };
  return {
    default: { t, language: 'ja', on: () => {}, changeLanguage: () => {} },
  };
});
