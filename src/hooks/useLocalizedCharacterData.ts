import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalizedCharacterData } from '../data/characters.ts';
import type { CharacterDef } from '../data/types.ts';

/**
 * 言語切替に追従するローカライズ済みキャラデータを返すフック。
 * i18n の言語が変わると自動的に再ビルドされる。
 */
export function useLocalizedCharacterData(): Record<string, CharacterDef> {
  const { t, i18n } = useTranslation();
  // i18n.language を dep にすることで、t 参照が安定しない場合でも
  // 言語切替時のみ再ビルドされることを保証する
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getLocalizedCharacterData(t), [i18n.language]);
}
