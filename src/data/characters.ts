import type { TFunction } from 'i18next';
import type { CharacterDef, CGDialogueLine, CGEvent, AfterEvent } from './types.ts';

// ── Helpers ──

function resolveDialogue(
  raw: Array<{ s: string; t: string }>,
  t: TFunction,
): CGDialogueLine[] {
  return raw.map((d) => ({
    speaker: d.s ? t(d.s) : '',
    text: d.t,
  }));
}

// ── Blaze: structural (non-translatable) data ──

const BLAZE_THEME = {
  color: '#e85d3a',
  colorDark: '#b8432a',
  colorGlow: 'rgba(232, 93, 58, 0.4)',
  icon: '🔥',
  portraitImg: '/characters/blaze/portrait-drunk-0.webp',
  portraitDrunkImgs: {
    0: '/characters/blaze/portrait-drunk-0.webp',
    1: '/characters/blaze/portrait-drunk-1.webp',
    2: '/characters/blaze/portrait-drunk-2.webp',
    3: '/characters/blaze/portrait-drunk-3.webp',
    4: '/characters/blaze/portrait-drunk-4.webp',
  },
} as const;

const BLAZE_COSTUME_META = [
  { level: 0, emoji: '👔', dishevelAmount: 0 },
  { level: 1, emoji: '👕', dishevelAmount: 0.2 },
  { level: 2, emoji: '💫', dishevelAmount: 0.5 },
  { level: 3, emoji: '🔥', dishevelAmount: 0.8 },
  { level: 4, emoji: '💋', dishevelAmount: 1.0 },
] as const;

const BLAZE_DRUNK_META = [
  { level: 0, threshold: 0 },
  { level: 1, threshold: 2 },
  { level: 2, threshold: 4 },
  { level: 3, threshold: 7 },
  { level: 4, threshold: 10 },
] as const;

const BLAZE_DECK_AI = {
  personality: 'aggressive' as const,
  defaultDeck: [
    'whiskey', 'whiskey', 'whiskey',
    'baijiu', 'baijiu',
    'wine',
    'yakitori', 'yakitori',
    'chug', 'chug',
    'foot_tease',
    'dirty_talk',
  ],
};

interface CGStructure {
  id: string;
  triggerCard: string;
  requiredDrunkLevel: number;
  cgColor: string;
  cgKey: string;            // locale key suffix (e.g. 'hand_hold')
  frames: Array<{
    src: string;
    dialogueStart: number;
    transition: 'fade' | 'slide-left' | 'zoom' | 'none';
  }>;
}

const BLAZE_CG_STRUCTURE: CGStructure[] = [
  {
    id: 'hand_hold_cg', triggerCard: 'hand_hold', requiredDrunkLevel: 1, cgColor: '#e85d3a',
    cgKey: 'hand_hold',
    frames: [
      { src: '/characters/blaze/cg/hand_hold_1.webp', dialogueStart: 0, transition: 'fade' },
      { src: '/characters/blaze/cg/hand_hold_2.webp', dialogueStart: 2, transition: 'fade' },
      { src: '/characters/blaze/cg/hand_hold_3.webp', dialogueStart: 4, transition: 'fade' },
      { src: '/characters/blaze/cg/hand_hold_4.webp', dialogueStart: 6, transition: 'fade' },
    ],
  },
  {
    id: 'shoulder_lean_cg', triggerCard: 'shoulder_lean', requiredDrunkLevel: 1, cgColor: '#e85d3a',
    cgKey: 'shoulder_lean',
    frames: [
      { src: '/characters/blaze/cg/shoulder_lean_1.webp', dialogueStart: 0, transition: 'fade' },
      { src: '/characters/blaze/cg/shoulder_lean_2.webp', dialogueStart: 1, transition: 'fade' },
      { src: '/characters/blaze/cg/shoulder_lean_3.webp', dialogueStart: 4, transition: 'fade' },
      { src: '/characters/blaze/cg/shoulder_lean_4.webp', dialogueStart: 6, transition: 'fade' },
    ],
  },
  {
    id: 'headpat_cg', triggerCard: 'headpat', requiredDrunkLevel: 2, cgColor: '#e85d3a',
    cgKey: 'headpat',
    frames: [
      { src: '/characters/blaze/cg/headpat_1.webp', dialogueStart: 0, transition: 'fade' },
      { src: '/characters/blaze/cg/headpat_2.webp', dialogueStart: 1, transition: 'fade' },
      { src: '/characters/blaze/cg/headpat_3.webp', dialogueStart: 4, transition: 'fade' },
    ],
  },
  {
    id: 'breast_touch_cg', triggerCard: 'breast_touch', requiredDrunkLevel: 2, cgColor: '#ff6b8a',
    cgKey: 'breast_touch',
    frames: [
      { src: '/characters/blaze/cg/breast_touch_1.webp', dialogueStart: 0, transition: 'fade' },
      { src: '/characters/blaze/cg/breast_touch_2.webp', dialogueStart: 4, transition: 'zoom' },
      { src: '/characters/blaze/cg/breast_touch_3.webp', dialogueStart: 6, transition: 'fade' },
    ],
  },
  {
    id: 'hip_touch_cg', triggerCard: 'hip_touch', requiredDrunkLevel: 2, cgColor: '#ff7b6b',
    cgKey: 'hip_touch',
    frames: [
      { src: '/characters/blaze/cg/hip_touch_1.webp', dialogueStart: 0, transition: 'fade' },
      { src: '/characters/blaze/cg/hip_touch_2.webp', dialogueStart: 1, transition: 'fade' },
      { src: '/characters/blaze/cg/hip_touch_3.webp', dialogueStart: 3, transition: 'fade' },
      { src: '/characters/blaze/cg/hip_touch_4.webp', dialogueStart: 4, transition: 'fade' },
    ],
  },
  {
    id: 'thigh_touch_cg', triggerCard: 'thigh_touch', requiredDrunkLevel: 2, cgColor: '#ff6b8a',
    cgKey: 'thigh_touch',
    frames: [
      { src: '/characters/blaze/cg/thigh_touch_1.webp', dialogueStart: 0, transition: 'fade' },
      { src: '/characters/blaze/cg/thigh_touch_2.webp', dialogueStart: 2, transition: 'fade' },
      { src: '/characters/blaze/cg/thigh_touch_3.webp', dialogueStart: 5, transition: 'zoom' },
      { src: '/characters/blaze/cg/thigh_touch_4.webp', dialogueStart: 7, transition: 'fade' },
    ],
  },
  {
    id: 'ear_bite_cg', triggerCard: 'ear_bite', requiredDrunkLevel: 3, cgColor: '#ff5577',
    cgKey: 'ear_bite',
    frames: [
      { src: '/characters/blaze/cg/ear_bite_1.webp', dialogueStart: 0, transition: 'slide-left' },
      { src: '/characters/blaze/cg/ear_bite_2.webp', dialogueStart: 1, transition: 'zoom' },
      { src: '/characters/blaze/cg/ear_bite_3.webp', dialogueStart: 3, transition: 'fade' },
    ],
  },
  {
    id: 'kiss_cg', triggerCard: 'kiss', requiredDrunkLevel: 3, cgColor: '#ff4466',
    cgKey: 'kiss',
    frames: [
      { src: '/characters/blaze/cg/kiss_1.webp', dialogueStart: 0, transition: 'fade' },
      { src: '/characters/blaze/cg/kiss_2.webp', dialogueStart: 2, transition: 'zoom' },
      { src: '/characters/blaze/cg/kiss_3.webp', dialogueStart: 3, transition: 'fade' },
      { src: '/characters/blaze/cg/kiss_4.webp', dialogueStart: 4, transition: 'fade' },
    ],
  },
  {
    id: 'foot_tease_cg', triggerCard: 'foot_tease', requiredDrunkLevel: 2, cgColor: '#ff5577',
    cgKey: 'foot_tease',
    frames: [
      { src: '/characters/blaze/cg/foot_tease_1.webp', dialogueStart: 0, transition: 'fade' },
      { src: '/characters/blaze/cg/foot_tease_2.webp', dialogueStart: 2, transition: 'zoom' },
      { src: '/characters/blaze/cg/foot_tease_3.webp', dialogueStart: 4, transition: 'fade' },
      { src: '/characters/blaze/cg/foot_tease_4.webp', dialogueStart: 7, transition: 'fade' },
    ],
  },
  {
    id: 'dirty_talk_cg', triggerCard: 'dirty_talk', requiredDrunkLevel: 2, cgColor: '#ff4488',
    cgKey: 'dirty_talk',
    frames: [
      { src: '/characters/blaze/cg/dirty_talk_1.webp', dialogueStart: 0, transition: 'slide-left' },
      { src: '/characters/blaze/cg/dirty_talk_2.webp', dialogueStart: 2, transition: 'zoom' },
      { src: '/characters/blaze/cg/dirty_talk_3.webp', dialogueStart: 4, transition: 'fade' },
    ],
  },
];

interface AfterStructure {
  id: string;
  requiredCGRate: number;
  requiredWins: number;
  afterKey: string;         // locale key suffix (e.g. 'tipsy')
  cgColor: string;
  emoji: string;
}

const BLAZE_AFTER_STRUCTURE: AfterStructure[] = [
  { id: 'blaze_after_tipsy', requiredCGRate: 0.25, requiredWins: 1, afterKey: 'tipsy', cgColor: '#e85d3a', emoji: '🌙' },
  { id: 'blaze_after_drunk', requiredCGRate: 0.5, requiredWins: 3, afterKey: 'drunk', cgColor: '#ff6b8a', emoji: '🛏️' },
  { id: 'blaze_after_morning', requiredCGRate: 0.75, requiredWins: 5, afterKey: 'morning', cgColor: '#ffaa66', emoji: '🌅' },
  { id: 'blaze_after_complete', requiredCGRate: 1.0, requiredWins: 8, afterKey: 'complete', cgColor: '#ff3355', emoji: '💕' },
];

// ── Public API ──

/**
 * Build fully-localized character data.
 * All user-facing strings are resolved via i18n `t()`.
 */
export function getLocalizedCharacterData(t: TFunction): Record<string, CharacterDef> {
  const P = 'char.blaze';
  const obj = <T>(key: string): T => t(key, { returnObjects: true }) as T;

  const blazeCgEvents: CGEvent[] = BLAZE_CG_STRUCTURE.map((cg) => {
    const rawDialogue = obj<Array<{ s: string; t: string }>>(`${P}.cg.${cg.cgKey}.dialogue`);
    const rawFrameLabels = obj<string[]>(`${P}.cg.${cg.cgKey}.frames`);
    return {
      id: cg.id,
      triggerCard: cg.triggerCard,
      requiredDrunkLevel: cg.requiredDrunkLevel,
      cgColor: cg.cgColor,
      dialogue: resolveDialogue(rawDialogue, t),
      frames: cg.frames.map((f, i) => ({
        src: f.src,
        dialogueStart: f.dialogueStart,
        transition: f.transition,
        label: rawFrameLabels[i] ?? '',
      })),
    };
  });

  const blazeAfterEvents: AfterEvent[] = BLAZE_AFTER_STRUCTURE.map((ae) => {
    const rawDialogue = obj<Array<{ s: string; t: string }>>(`${P}.after.${ae.afterKey}.dialogue`);
    return {
      id: ae.id,
      requiredCGRate: ae.requiredCGRate,
      requiredWins: ae.requiredWins,
      title: t(`${P}.after.${ae.afterKey}.title`),
      cgColor: ae.cgColor,
      emoji: ae.emoji,
      dialogue: resolveDialogue(rawDialogue, t),
    };
  });

  return {
    blaze: {
      id: 'blaze',
      name: t(`${P}.name`),
      nameEn: 'BLAZE',
      subtitle: t(`${P}.subtitle`),
      theme: { ...BLAZE_THEME },
      drunkType: 'aggressive',
      drunkMax: 10,
      costumeStates: BLAZE_COSTUME_META.map((m) => ({
        level: m.level,
        label: t(`${P}.costume.${m.level}.label`),
        emoji: m.emoji,
        description: t(`${P}.costume.${m.level}.desc`),
        dishevelAmount: m.dishevelAmount,
      })),
      drunkLevels: BLAZE_DRUNK_META.map((m) => ({
        level: m.level,
        name: t(`${P}.drunk.${m.level}.name`),
        threshold: m.threshold,
        lines: obj<string[]>(`${P}.drunk.${m.level}.lines`),
      })),
      battleLines: {
        playDrink: obj<string[]>(`${P}.battle.playDrink`),
        playFood: obj<string[]>(`${P}.battle.playFood`),
        playChug: obj<string[]>(`${P}.battle.playChug`),
        takeDamage: obj<string[]>(`${P}.battle.takeDamage`),
        dealDamage: obj<string[]>(`${P}.battle.dealDamage`),
        harassmentSuccess: obj<string[]>(`${P}.battle.harassmentSuccess`),
        harassmentFail: obj<string[]>(`${P}.battle.harassmentFail`),
        winLine: t(`${P}.battle.winLine`),
        loseLine: t(`${P}.battle.loseLine`),
      },
      deck_ai: { ...BLAZE_DECK_AI },
      cgEvents: blazeCgEvents,
      afterEvents: blazeAfterEvents,
    },
  };
}