import { describe, expect, it } from 'vitest';
import { judgeRitual } from '../src/rituals';
import { DECK_COMPOSITION, ELEMENTS, RITUAL_DEFS } from '../src/types';
import type { Card, CardKind, ManaElement, PlayerId, RitualId, TurnRecord } from '../src/types';

// -------------------------------------------------------------
// テスト用の組み立て
// -------------------------------------------------------------

let nextId = 0;
function card(kind: CardKind, element: ManaElement): Card {
  return { id: `c${nextId++}`, kind, element };
}

/** 属性だけ指定したい場合の効果なしカード */
const light = (element: ManaElement) => card('manaLight', element);

function turn(usedCards: Card[], opts: { player?: PlayerId; unveiled?: boolean } = {}): TurnRecord {
  return {
    player: opts.player ?? 0,
    turnNumber: 2,
    usedCards,
    unveiled: opts.unveiled ?? false,
    progressed: false,
    events: [],
  };
}

const opp = (usedCards: Card[], opts: { unveiled?: boolean } = {}) => turn(usedCards, { player: 1, ...opts });

function judge(ritual: RitualId, used: Card[], opponentPrev: TurnRecord | null = opp([])): boolean {
  return judgeRitual(ritual, { turn: turn(used), opponentPrev });
}

// -------------------------------------------------------------
// 山札の構成
// -------------------------------------------------------------

describe('山札の構成', () => {
  it('合計60枚、各属性15枚', () => {
    const counts = Object.values(DECK_COMPOSITION);
    const total = counts.reduce((sum, c) => sum + ELEMENTS.reduce((s, e) => s + c[e], 0), 0);
    expect(total).toBe(60);
    for (const e of ELEMENTS) {
      expect(counts.reduce((s, c) => s + c[e], 0)).toBe(15);
    }
  });

  it('儀式は13種類', () => {
    expect(Object.keys(RITUAL_DEFS)).toHaveLength(13);
  });
});

// -------------------------------------------------------------
// 属性系
// -------------------------------------------------------------

describe('属性系', () => {
  it('業火の召喚：火を1枚以上', () => {
    expect(judge('infernoSummon', [light('fire')])).toBe(true);
    expect(judge('infernoSummon', [light('water'), light('fire')])).toBe(true);
    expect(judge('infernoSummon', [light('water')])).toBe(false);
    expect(judge('infernoSummon', [])).toBe(false);
  });

  it('業火の召喚：自分が伏せた火の結界も数える', () => {
    expect(judge('infernoSummon', [card('barrier', 'fire')])).toBe(true);
  });

  it('深淵の潮：水を2枚', () => {
    expect(judge('abyssalTide', [light('water'), light('water')])).toBe(true);
    expect(judge('abyssalTide', [light('water')])).toBe(false);
    expect(judge('abyssalTide', [light('water'), light('fire')])).toBe(false);
  });

  it('四元素の調和：異なる属性を2枚', () => {
    expect(judge('elementalHarmony', [light('fire'), light('earth')])).toBe(true);
    expect(judge('elementalHarmony', [light('fire'), light('fire')])).toBe(false);
    expect(judge('elementalHarmony', [light('fire')])).toBe(false);
  });

  it('双子星の儀：同じ属性を2枚', () => {
    expect(judge('twinStars', [light('earth'), light('earth')])).toBe(true);
    expect(judge('twinStars', [light('earth'), light('wind')])).toBe(false);
    expect(judge('twinStars', [light('earth')])).toBe(false);
  });

  it('疾風の先触れ：最初に使うカードが風', () => {
    expect(judge('galeHerald', [light('wind')])).toBe(true);
    expect(judge('galeHerald', [light('wind'), light('fire')])).toBe(true);
    expect(judge('galeHerald', [light('fire'), light('wind')])).toBe(false);
    expect(judge('galeHerald', [])).toBe(false);
  });
});

// -------------------------------------------------------------
// 行動系
// -------------------------------------------------------------

describe('行動系', () => {
  it('瞑想：カードを1枚も使わない', () => {
    expect(judge('meditation', [])).toBe(true);
    expect(judge('meditation', [light('fire')])).toBe(false);
  });

  it('瞑想：看破のターンも満たす', () => {
    expect(judgeRitual('meditation', { turn: turn([], { unveiled: true }), opponentPrev: null })).toBe(true);
  });

  it('静謐の祈り：ちょうど1枚', () => {
    expect(judge('serenePrayer', [light('fire')])).toBe(true);
    expect(judge('serenePrayer', [])).toBe(false);
    expect(judge('serenePrayer', [light('fire'), light('water')])).toBe(false);
  });

  it('星読みの儀：遠見を使う', () => {
    expect(judge('stargazing', [card('farsight', 'wind')])).toBe(true);
    expect(judge('stargazing', [card('clairvoyance', 'wind')])).toBe(false);
  });

  it('供物の儀：錬成で満たし、魔力乱流では満たさない', () => {
    expect(judge('offering', [card('transmute', 'water')])).toBe(true);
    expect(judge('offering', [card('manaStorm', 'fire')])).toBe(false);
  });

  it('呪詛の儀：妨害カードを使う', () => {
    expect(judge('malediction', [card('ritualBreak', 'fire')])).toBe(true);
    expect(judge('malediction', [card('seal', 'earth')])).toBe(true);
    expect(judge('malediction', [card('manaStorm', 'water')])).toBe(true);
    expect(judge('malediction', [card('barrier', 'earth')])).toBe(false);
  });
});

// -------------------------------------------------------------
// 相手依存系
// -------------------------------------------------------------

describe('相手依存系', () => {
  const ALL_OPPONENT: RitualId[] = ['mirrorImage', 'shadowStitch', 'mimicry'];

  it('先攻の最初のターン（相手の直前のターンなし）は満たさない', () => {
    for (const r of ALL_OPPONENT) {
      expect(judge(r, [light('fire')], null)).toBe(false);
      expect(judge(r, [], null)).toBe(false);
    }
  });

  it('写し身の儀：相手が使った属性と同じ属性を使う', () => {
    const prev = opp([light('fire'), light('water')]);
    expect(judge('mirrorImage', [light('water')], prev)).toBe(true);
    expect(judge('mirrorImage', [light('wind')], prev)).toBe(false);
  });

  it('写し身の儀：相手が伏せた結界の属性は見えないので数えない', () => {
    const prev = opp([card('barrier', 'earth')]);
    expect(judge('mirrorImage', [light('earth')], prev)).toBe(false);
  });

  it('影縫いの儀：相手が使わなかった属性を使う', () => {
    const prev = opp([light('fire'), light('water')]);
    expect(judge('shadowStitch', [light('wind')], prev)).toBe(true);
    expect(judge('shadowStitch', [light('fire')], prev)).toBe(false);
    expect(judge('shadowStitch', [light('fire'), light('earth')], prev)).toBe(true);
  });

  it('影縫いの儀：相手が伏せた結界の属性は「使わなかった」扱い', () => {
    const prev = opp([card('barrier', 'earth')]);
    expect(judge('shadowStitch', [light('earth')], prev)).toBe(true);
  });

  it('影縫いの儀：相手が看破したターンはどの属性でも満たす', () => {
    expect(judge('shadowStitch', [light('fire')], opp([], { unveiled: true }))).toBe(true);
  });

  it('追従の儀：相手と同じ枚数を使う', () => {
    expect(judge('mimicry', [light('fire')], opp([light('water')]))).toBe(true);
    expect(judge('mimicry', [light('fire'), light('fire')], opp([light('water')]))).toBe(false);
    expect(judge('mimicry', [], opp([]))).toBe(true);
  });

  it('追従の儀：相手が伏せた結界も1枚として数える', () => {
    expect(judge('mimicry', [light('fire')], opp([card('barrier', 'earth')]))).toBe(true);
  });

  it('追従の儀：相手が看破したターンは0枚として扱う', () => {
    expect(judge('mimicry', [], opp([], { unveiled: true }))).toBe(true);
    expect(judge('mimicry', [light('fire')], opp([], { unveiled: true }))).toBe(false);
  });
});
