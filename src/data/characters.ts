import type { CharacterDef } from './types.ts';
import { blaze } from './characters/blaze.ts';

/** キャラクター追加時は characters/ にファイルを作って、ここに登録 */
export const CHARACTER_DATA: Record<string, CharacterDef> = {
  blaze,
};
