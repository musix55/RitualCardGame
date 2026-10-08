// =============================================================
// バランス検証用のルールの組み合わせ（scripts/simulate.ts の --variant で選ぶ）
// =============================================================

import { DECK_COMPOSITION, DEFAULT_CONFIG } from './types';
import type { GameConfig } from './types';
import type { RitualRules } from './rituals';

/** 第1弾の山札：錬成を8枚→12枚、魔力の灯を12枚→8枚（各属性15枚は変えない） */
export const PROPOSED_DECK_COMPOSITION: GameConfig['deckComposition'] = {
  ...DECK_COMPOSITION,
  manaLight: { fire: 2, water: 2, wind: 2, earth: 2 },
  transmute: { fire: 3, water: 4, wind: 2, earth: 3 },
};

export interface BalanceVariant {
  readonly label: string;
  readonly config: GameConfig;
}

/** 第1弾：6つの儀式の条件の変更、錬成の増量、先攻の最初のターンは2枚まで */
const PROPOSAL1_RULES: RitualRules = {
  abyssalTide: 'alt1',
  stargazing: 'alt1',
  elementalHarmony: 'alt1',
  twinStars: 'alt1',
  mimicry: 'alt1',
  shadowStitch: 'alt1',
};

const PROPOSAL1: GameConfig = {
  ...DEFAULT_CONFIG,
  ritualRules: PROPOSAL1_RULES,
  deckComposition: PROPOSED_DECK_COMPOSITION,
  firstTurnMaxCards: 2,
};

/**
 * 第2弾：第1弾から、影縫い・星読みを第2案に、供物を「錬成か魔力の灯」に変える。
 * 山札は現行の構成に戻し、先攻の最初のターンは1枚のまま。
 */
const PROPOSAL2: GameConfig = {
  ...DEFAULT_CONFIG,
  ritualRules: { ...PROPOSAL1_RULES, stargazing: 'alt2', shadowStitch: 'alt2', offering: 'alt1' },
};

/** 第3弾：第2弾から、双子星を第2案に、静謐の祈り・呪詛の儀を調整案に変える */
const PROPOSAL3: GameConfig = {
  ...PROPOSAL2,
  ritualRules: { ...PROPOSAL2.ritualRules, twinStars: 'alt2', serenePrayer: 'alt1', malediction: 'alt1' },
};

/**
 * 現行（v0.3）は DEFAULT_CONFIG。第3弾の双子星を第4案（分類の異なる2枚）にしたもの。
 * 以下の第1弾〜第3弾は、v0.3 を決めるまでの比較の記録として残している。
 */
export const BALANCE_VARIANTS = {
  current: { label: '現行（v0.3）', config: DEFAULT_CONFIG },
  /** 儀式の条件をすべて仕様書 v0.2 のままにしたもの */
  'v0.2': { label: 'v0.2', config: { ...DEFAULT_CONFIG, ritualRules: {} } },
  proposal: { label: '調整案', config: PROPOSAL1 },
  /** 先攻の枚数制限を変えた効果だけを切り分けるため、制限を1枚のまま残した第1弾 */
  'proposal-first1': { label: '調整案（先攻1枚）', config: { ...PROPOSAL1, firstTurnMaxCards: 1 } },
  proposal2: { label: '第2弾', config: PROPOSAL2 },
  proposal3: { label: '第3弾', config: PROPOSAL3 },
  /** 第3弾の双子星を、種類の異なる2枚（第3案）にしたもの。効果が小さく不採用 */
  'proposal3-kind': {
    label: '第3弾・双子星3',
    config: { ...PROPOSAL3, ritualRules: { ...PROPOSAL3.ritualRules, twinStars: 'alt3' } },
  },
} as const satisfies Record<string, BalanceVariant>;

export type BalanceVariantId = keyof typeof BALANCE_VARIANTS;
