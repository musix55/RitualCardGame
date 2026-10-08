import { describe, expect, it } from 'vitest';
import { judgeRitual, ritualDescription } from '../src/rituals';
import type { RitualRules } from '../src/rituals';
import { DECK_COMPOSITION, DEFAULT_CONFIG, ELEMENTS, RITUAL_DEFS } from '../src/types';
import { BALANCE_VARIANTS, PROPOSED_DECK_COMPOSITION } from '../src/variants';
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
  const compositions = [
    ['現行', DECK_COMPOSITION],
    ['調整案', PROPOSED_DECK_COMPOSITION],
  ] as const;
  for (const [label, composition] of compositions) {
    it(`${label}：合計60枚、各属性15枚`, () => {
      const counts = Object.values(composition);
      const total = counts.reduce((sum, c) => sum + ELEMENTS.reduce((s, e) => s + c[e], 0), 0);
      expect(total).toBe(60);
      for (const e of ELEMENTS) {
        expect(counts.reduce((s, c) => s + c[e], 0)).toBe(15);
      }
    });
  }

  it('調整案：錬成12枚、魔力の灯8枚', () => {
    const sum = (kind: CardKind) => ELEMENTS.reduce((s, e) => s + PROPOSED_DECK_COMPOSITION[kind][e], 0);
    expect(sum('transmute')).toBe(12);
    expect(sum('manaLight')).toBe(8);
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

// -------------------------------------------------------------
// 調整案
// -------------------------------------------------------------

describe('調整案', () => {
  const ALT1: RitualRules = {
    abyssalTide: 'alt1',
    stargazing: 'alt1',
    offering: 'alt1',
    elementalHarmony: 'alt1',
    twinStars: 'alt1',
    mimicry: 'alt1',
    shadowStitch: 'alt1',
  };

  function alt(ritual: RitualId, used: Card[], opponentPrev: TurnRecord | null = opp([]), ownPrev: TurnRecord | null = null) {
    return judgeRitual(ritual, { turn: turn(used), opponentPrev, ownPrev }, ALT1);
  }

  it('調整案を指定しない儀式は現行の条件のまま', () => {
    expect(judgeRitual('abyssalTide', { turn: turn([light('water')]), opponentPrev: null }, { stargazing: 'alt1' })).toBe(false);
  });

  it('深淵の潮：水を1枚以上', () => {
    expect(alt('abyssalTide', [light('water')])).toBe(true);
    expect(alt('abyssalTide', [light('fire')])).toBe(false);
  });

  it('星読みの儀：遠見か透視', () => {
    expect(alt('stargazing', [card('farsight', 'wind')])).toBe(true);
    expect(alt('stargazing', [card('clairvoyance', 'earth')])).toBe(true);
    expect(alt('stargazing', [card('fountain', 'wind')])).toBe(false);
  });

  it('四元素の調和：自分の直近2ターンで合わせて3属性以上', () => {
    const prev = turn([light('fire'), light('water')]);
    expect(alt('elementalHarmony', [light('wind')], opp([]), prev)).toBe(true);
    expect(alt('elementalHarmony', [light('fire')], opp([]), prev)).toBe(false);
    expect(alt('elementalHarmony', [light('fire'), light('water')], opp([]), null)).toBe(false);
  });

  it('双子星の儀：魔力の灯以外で同じ属性を2枚', () => {
    expect(alt('twinStars', [card('fountain', 'earth'), card('seal', 'earth')])).toBe(true);
    expect(alt('twinStars', [light('earth'), card('seal', 'earth')])).toBe(false);
  });

  it('追従の儀：同じ枚数かつ1枚以上', () => {
    expect(alt('mimicry', [light('fire')], opp([light('water')]))).toBe(true);
    expect(alt('mimicry', [], opp([]))).toBe(false);
  });

  it('影縫いの儀：使ったカードがすべて相手の使わなかった属性', () => {
    const prev = opp([light('fire')]);
    expect(alt('shadowStitch', [light('water'), light('wind')], prev)).toBe(true);
    expect(alt('shadowStitch', [light('water'), light('fire')], prev)).toBe(false);
    expect(alt('shadowStitch', [], prev)).toBe(false);
  });

  it('供物の儀：錬成か魔力の灯', () => {
    expect(alt('offering', [card('transmute', 'water')])).toBe(true);
    expect(alt('offering', [light('fire')])).toBe(true);
    expect(alt('offering', [card('manaStorm', 'fire')])).toBe(false);
  });

  describe('第2案', () => {
    const ALT2: RitualRules = { stargazing: 'alt2', shadowStitch: 'alt2' };
    const alt2 = (ritual: RitualId, used: Card[], opponentPrev: TurnRecord | null = opp([])) =>
      judgeRitual(ritual, { turn: turn(used), opponentPrev }, ALT2);

    it('星読みの儀：遠見・透視・知識の泉', () => {
      expect(alt2('stargazing', [card('fountain', 'water')])).toBe(true);
      expect(alt2('stargazing', [card('clairvoyance', 'wind')])).toBe(true);
      expect(alt2('stargazing', [card('transmute', 'wind')])).toBe(false);
    });

    it('影縫いの儀：2枚使い、どちらも相手の使わなかった属性', () => {
      const prev = opp([light('fire')]);
      expect(alt2('shadowStitch', [light('water'), light('wind')], prev)).toBe(true);
      expect(alt2('shadowStitch', [light('water')], prev)).toBe(false);
      expect(alt2('shadowStitch', [light('water'), light('fire')], prev)).toBe(false);
    });
  });

  describe('第3弾', () => {
    const ALT3: RitualRules = { twinStars: 'alt2', serenePrayer: 'alt1', malediction: 'alt1' };
    const alt3 = (ritual: RitualId, used: Card[], ownPrev: TurnRecord | null = null) =>
      judgeRitual(ritual, { turn: turn(used), opponentPrev: opp([]), ownPrev }, ALT3);

    it('双子星の儀：同じ属性2枚。魔力の灯どうしだけは不可', () => {
      expect(alt3('twinStars', [light('earth'), card('seal', 'earth')])).toBe(true);
      expect(alt3('twinStars', [card('fountain', 'earth'), card('seal', 'earth')])).toBe(true);
      expect(alt3('twinStars', [light('earth'), light('earth')])).toBe(false);
      expect(alt3('twinStars', [light('earth'), card('seal', 'fire')])).toBe(false);
    });

    it('双子星の儀（第3案）：同じ属性で種類の異なる2枚', () => {
      const j = (used: Card[]) => judgeRitual('twinStars', { turn: turn(used), opponentPrev: null }, { twinStars: 'alt3' });
      expect(j([light('earth'), card('seal', 'earth')])).toBe(true);
      expect(j([card('fountain', 'earth'), card('transmute', 'earth')])).toBe(true);
      expect(j([card('fountain', 'earth'), card('fountain', 'earth')])).toBe(false);
      expect(j([light('earth'), light('earth')])).toBe(false);
    });

    it('双子星の儀（第4案）：同じ属性で分類の異なる2枚', () => {
      const j = (used: Card[]) => judgeRitual('twinStars', { turn: turn(used), opponentPrev: null }, { twinStars: 'alt4' });
      expect(j([light('earth'), card('seal', 'earth')])).toBe(true);
      expect(j([card('barrier', 'earth'), card('seal', 'earth')])).toBe(true);
      expect(j([card('fountain', 'earth'), card('transmute', 'earth')])).toBe(false);
      expect(j([card('ritualBreak', 'fire'), card('manaStorm', 'fire')])).toBe(false);
      expect(j([light('earth'), card('seal', 'fire')])).toBe(false);
    });

    it('静謐の祈り：ちょうど1枚、自分の直前のターンに使わなかった属性', () => {
      const prev = turn([light('fire'), light('water')]);
      expect(alt3('serenePrayer', [light('wind')], prev)).toBe(true);
      expect(alt3('serenePrayer', [light('fire')], prev)).toBe(false);
      expect(alt3('serenePrayer', [light('fire')], null)).toBe(true);
      expect(alt3('serenePrayer', [light('wind'), light('earth')], prev)).toBe(false);
    });

    it('呪詛の儀：妨害カードか結界', () => {
      expect(alt3('malediction', [card('barrier', 'earth')])).toBe(true);
      expect(alt3('malediction', [card('ritualBreak', 'fire')])).toBe(true);
      expect(alt3('malediction', [card('clairvoyance', 'wind')])).toBe(false);
    });
  });

  it('存在しない調整案を指定するとエラー', () => {
    expect(() => judgeRitual('meditation', { turn: turn([]), opponentPrev: null }, { meditation: 'alt1' })).toThrow();
  });

  it('条件の説明も設定に合わせて切り替わる', () => {
    expect(ritualDescription('offering')).toBe(RITUAL_DEFS.offering.description);
    expect(ritualDescription('offering', { offering: 'alt1' })).toBe('錬成か魔力の灯を使う');
  });

  it('既定の設定は v0.3（第3弾の双子星を第4案にしたもの）', () => {
    expect(DEFAULT_CONFIG.ritualRules).toEqual({ ...BALANCE_VARIANTS.proposal3.config.ritualRules, twinStars: 'alt4' });
    expect(ritualDescription('twinStars', DEFAULT_CONFIG.ritualRules)).toBe('同じ属性で、分類の異なるカードを2枚使う');
  });
});
