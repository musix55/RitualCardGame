import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../src/engine';
import { createGame } from '../src/setup';
import { getPlayerView } from '../src/view';
import { RITUAL_DEFS, RITUAL_IDS } from '../src/types';
import { act, card, midGame, patch, reject, startedGame } from './helpers';

// -------------------------------------------------------------
// 準備
// -------------------------------------------------------------

describe('ゲームの準備', () => {
  it('5枚ずつ配り、山札は50枚', () => {
    const s = createGame(1);
    expect(s.phase).toBe('ritualSelection');
    expect(s.players[0].hand).toHaveLength(5);
    expect(s.players[1].hand).toHaveLength(5);
    expect(s.deck).toHaveLength(50);
  });

  it('儀式の候補は属性系・行動系・相手依存系から1つずつ', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = createGame(seed);
      for (const p of s.players) {
        expect(p.ritualCandidates.map((r) => RITUAL_DEFS[r].category)).toEqual(['element', 'action', 'opponent']);
      }
    }
  });

  it('同じシードなら同じ対戦になる', () => {
    expect(createGame(42)).toEqual(createGame(42));
    expect(createGame(42).deck).not.toEqual(createGame(43).deck);
  });

  it('両者が儀式を選ぶと対戦が始まる', () => {
    let s = createGame(1);
    const notCandidate = RITUAL_IDS.find((r) => !s.players[0].ritualCandidates.includes(r))!;
    expect(reject(s, { type: 'selectRitual', player: 0, ritual: notCandidate })).toContain('候補にない');
    s = act(s, { type: 'selectRitual', player: 0, ritual: s.players[0].ritualCandidates[1]! });
    expect(s.phase).toBe('ritualSelection');
    s = act(s, { type: 'selectRitual', player: 1, ritual: s.players[1].ritualCandidates[2]! });
    expect(s.phase).toBe('playing');
    expect(s.currentPlayer).toBe(0);
  });
});

// -------------------------------------------------------------
// ターンの流れ
// -------------------------------------------------------------

describe('ターンの流れ', () => {
  it('先攻の最初のターンは1枚まで', () => {
    const hand = [card('manaLight', 'fire'), card('manaLight', 'water')];
    let s = patch(startedGame(), (d) => (d.players[0].hand = hand));
    s = act(s, { type: 'playCard', player: 0, cardId: hand[0]!.id });
    expect(reject(s, { type: 'playCard', player: 0, cardId: hand[1]!.id })).toContain('もうカードを使えません');
  });

  it('通常のターンは2枚まで', () => {
    const hand = [card('manaLight', 'fire'), card('manaLight', 'water'), card('manaLight', 'wind')];
    let s = patch(midGame(), (d) => (d.players[0].hand = hand));
    s = act(s, { type: 'playCard', player: 0, cardId: hand[0]!.id });
    s = act(s, { type: 'playCard', player: 0, cardId: hand[1]!.id });
    expect(reject(s, { type: 'playCard', player: 0, cardId: hand[2]!.id })).toContain('もうカードを使えません');
  });

  it('条件を満たすと進行度+1、ターン交代して相手が補充する', () => {
    const fire = card('manaLight', 'fire');
    let s = patch(midGame(), (d) => {
      d.players[0].ritual = 'serenePrayer';
      d.players[0].hand = [fire];
      d.players[1].hand = [card('manaLight', 'earth')];
    });
    s = act(s, { type: 'playCard', player: 0, cardId: fire.id });
    s = act(s, { type: 'endTurn', player: 0 });
    expect(s.players[0].progress).toBe(1);
    expect(s.history.at(-1)!.progressed).toBe(true);
    expect(s.currentPlayer).toBe(1);
    expect(s.players[1].hand).toHaveLength(5);
  });

  it('封印されていると条件を満たしても進行度が上がらず、封印は1回で解ける', () => {
    let s = patch(midGame(), (d) => {
      d.players[0].ritual = 'meditation';
      d.players[0].sealed = true;
    });
    s = act(s, { type: 'endTurn', player: 0 });
    expect(s.players[0].progress).toBe(0);
    expect(s.players[0].sealed).toBe(false);
  });

  it('自分のターン以外は行動できない', () => {
    expect(reject(midGame(), { type: 'endTurn', player: 1 })).toContain('自分のターンではありません');
  });
});

// -------------------------------------------------------------
// カードを使わないターンの連続制限
// -------------------------------------------------------------

describe('カードを使わないターンの連続制限', () => {
  /** 先攻がカードを使わずにターンを終え、後攻が1枚使って終えた状態 */
  function afterPass() {
    let s = midGame();
    s = act(s, { type: 'endTurn', player: 0 });
    s = act(s, { type: 'playCard', player: 1, cardId: s.players[1].hand.find((c) => c.kind !== 'transmute' && c.kind !== 'farsight')!.id });
    return act(s, { type: 'endTurn', player: 1 });
  }

  it('2ターン続けてカードを使わずに終えることはできない', () => {
    const s = afterPass();
    expect(s.currentPlayer).toBe(0);
    expect(reject(s, { type: 'endTurn', player: 0 })).toContain('前のターンにカードを使わなかった');
  });

  it('カードを使えばターンを終えられる', () => {
    const light = card('manaLight', 'fire');
    let s = patch(afterPass(), (d) => d.players[0].hand.push(light));
    s = act(s, { type: 'playCard', player: 0, cardId: light.id });
    expect(act(s, { type: 'endTurn', player: 0 }).currentPlayer).toBe(1);
  });

  it('看破すればターンを終えられる', () => {
    let s = patch(afterPass(), (d) => (d.players[0].progress = 1));
    s = act(s, { type: 'unveil', player: 0, ritual: 'meditation' });
    expect(act(s, { type: 'endTurn', player: 0 }).currentPlayer).toBe(1);
  });

  it('看破したターンは「カードを使わなかったターン」に数えない', () => {
    let s = patch(midGame(), (d) => (d.players[0].progress = 1));
    s = act(s, { type: 'unveil', player: 0, ritual: 'meditation' });
    s = act(s, { type: 'endTurn', player: 0 });
    s = act(s, { type: 'endTurn', player: 1 });
    expect(act(s, { type: 'endTurn', player: 0 }).currentPlayer).toBe(1);
  });

  it('使えるカードがなければ例外としてターンを終えられる', () => {
    const s = patch(afterPass(), (d) => {
      d.players[0].barrier = card('barrier', 'earth');
      d.players[0].hand = [card('barrier', 'fire')];
    });
    expect(act(s, { type: 'endTurn', player: 0 }).currentPlayer).toBe(1);
  });
});

// -------------------------------------------------------------
// カードの効果
// -------------------------------------------------------------

describe('カードの効果', () => {
  it('知識の泉：1枚引く。山札が空なら空打ち', () => {
    const fountain = card('fountain', 'water');
    let s = patch(midGame(), (d) => (d.players[0].hand = [fountain]));
    expect(act(s, { type: 'playCard', player: 0, cardId: fountain.id }).players[0].hand).toHaveLength(1);

    s = patch(s, (d) => (d.deck = []));
    const after = act(s, { type: 'playCard', player: 0, cardId: fountain.id });
    expect(after.players[0].hand).toHaveLength(0);
    expect(after.currentTurn.usedCards).toHaveLength(1);
  });

  it('遠見：選択待ちの間は他の行動ができず、並べ替えた順で山札に戻る', () => {
    const farsight = card('farsight', 'wind');
    let s = patch(midGame(), (d) => (d.players[0].hand = [farsight, card('manaLight', 'fire')]));
    s = act(s, { type: 'playCard', player: 0, cardId: farsight.id });
    const top = s.deck.slice(0, 3).map((c) => c.id);
    expect(s.pendingChoice?.cards.map((c) => c.id)).toEqual(top);
    expect(reject(s, { type: 'endTurn', player: 0 })).toContain('選択待ち');

    const reversed = [...top].reverse();
    s = act(s, { type: 'arrangeDeckTop', player: 0, orderedCardIds: reversed });
    expect(s.deck.slice(0, 3).map((c) => c.id)).toEqual(reversed);
    expect(s.pendingChoice).toBeNull();
  });

  it('遠見：山札が1枚以下なら選択を待たない', () => {
    const farsight = card('farsight', 'wind');
    const s = patch(midGame(), (d) => {
      d.players[0].hand = [farsight];
      d.deck = d.deck.slice(0, 1);
    });
    expect(act(s, { type: 'playCard', player: 0, cardId: farsight.id }).pendingChoice).toBeNull();
  });

  it('錬成：捨てるカードの指定が必要で、捨てて2枚引く', () => {
    const transmute = card('transmute', 'water');
    const junk = card('manaLight', 'earth');
    const s = patch(midGame(), (d) => (d.players[0].hand = [transmute, junk]));
    expect(reject(s, { type: 'playCard', player: 0, cardId: transmute.id })).toContain('捨てるカードを指定');

    const after = act(s, { type: 'playCard', player: 0, cardId: transmute.id, discardCardId: junk.id });
    expect(after.players[0].hand).toHaveLength(2);
    expect(after.discard.map((c) => c.id)).toEqual([transmute.id, junk.id]);
  });

  it('錬成：手札が錬成だけなら使えない', () => {
    const transmute = card('transmute', 'water');
    const s = patch(midGame(), (d) => (d.players[0].hand = [transmute]));
    expect(getLegalActions(s, 0).some((a) => a.type === 'playCard')).toBe(false);
  });

  it('術式干渉：相手の進行度を1下げる。0なら効果なしだが使える', () => {
    const rb = card('ritualBreak', 'fire');
    let s = patch(midGame(), (d) => {
      d.players[0].hand = [rb];
      d.players[1].progress = 2;
    });
    expect(act(s, { type: 'playCard', player: 0, cardId: rb.id }).players[1].progress).toBe(1);

    s = patch(s, (d) => (d.players[1].progress = 0));
    expect(act(s, { type: 'playCard', player: 0, cardId: rb.id }).players[1].progress).toBe(0);
  });

  it('魔力乱流：相手の手札をランダムに1枚捨てさせる', () => {
    const storm = card('manaStorm', 'fire');
    const s = patch(midGame(), (d) => (d.players[0].hand = [storm]));
    const after = act(s, { type: 'playCard', player: 0, cardId: storm.id });
    expect(after.players[1].hand).toHaveLength(4);
    const ev = after.currentTurn.events.find((e) => e.type === 'handDiscarded');
    expect(ev).toBeDefined();
    expect(after.discard.at(-1)).toEqual(ev && 'card' in ev ? ev.card : undefined);
  });

  it('結界：設置は1枚まで。相手の妨害を1回無効化して捨て札になる', () => {
    const barrier = card('barrier', 'earth');
    const barrier2 = card('barrier', 'fire');
    let s = patch(midGame(), (d) => (d.players[0].hand = [barrier, barrier2]));
    s = act(s, { type: 'playCard', player: 0, cardId: barrier.id });
    expect(s.players[0].barrier).toEqual(barrier);
    expect(reject(s, { type: 'playCard', player: 0, cardId: barrier2.id })).toContain('すでに設置');

    const seal = card('seal', 'earth');
    s = patch(s, (d) => {
      d.currentPlayer = 1;
      d.players[1].hand = [seal];
    });
    s = act(s, { type: 'playCard', player: 1, cardId: seal.id });
    expect(s.players[0].sealed).toBe(false);
    expect(s.players[0].barrier).toBeNull();
    expect(s.discard.map((c) => c.id)).toContain(barrier.id);
    expect(s.currentTurn.events.some((e) => e.type === 'disruptBlocked')).toBe(true);
  });

  it('透視：相手の儀式と除外済みの儀式は提示されず、残りがなければ0個', () => {
    const cv = card('clairvoyance', 'wind');
    let s = patch(midGame(), (d) => {
      d.players[0].hand = [cv];
      d.players[1].ritual = 'meditation';
      d.players[0].excludedRituals = RITUAL_IDS.filter((r) => r !== 'meditation' && r !== 'mimicry' && r !== 'offering');
    });
    s = act(s, { type: 'playCard', player: 0, cardId: cv.id });
    expect([...s.players[0].excludedRituals.slice(-2)].sort()).toEqual(['mimicry', 'offering']);

    s = patch(s, (d) => {
      d.currentTurn.usedCards = [];
      d.players[0].hand = [cv];
    });
    s = act(s, { type: 'playCard', player: 0, cardId: cv.id });
    expect(s.players[0].excludedRituals).not.toContain('meditation');
    expect(s.players[0].excludedRituals).toHaveLength(12);
  });
});

// -------------------------------------------------------------
// 看破
// -------------------------------------------------------------

describe('看破', () => {
  it('進行度0では使えない', () => {
    expect(reject(midGame(), { type: 'unveil', player: 0, ritual: 'meditation' })).toContain('進行度1以上');
  });

  it('成功：相手の進行度-2、儀式が公開される', () => {
    let s = patch(midGame(), (d) => {
      d.players[0].progress = 1;
      d.players[1].ritual = 'twinStars';
      d.players[1].progress = 3;
    });
    s = act(s, { type: 'unveil', player: 0, ritual: 'twinStars' });
    expect(s.players[1].progress).toBe(1);
    expect(s.players[1].ritualRevealed).toBe(true);
    expect(getPlayerView(s, 0).opponent.ritual).toBe('twinStars');
  });

  it('失敗：自分の進行度-1。1ゲームに1回だけ', () => {
    let s = patch(midGame(), (d) => {
      d.players[0].progress = 2;
      d.players[1].ritual = 'twinStars';
    });
    s = act(s, { type: 'unveil', player: 0, ritual: 'meditation' });
    expect(s.players[0].progress).toBe(1);
    expect(s.players[0].unveilUsed).toBe(true);
    expect(reject(s, { type: 'unveil', player: 0, ritual: 'twinStars' })).toBeTruthy();
  });

  it('看破したターンはカードを使えない。カードを使ったターンは看破できない', () => {
    const light = card('manaLight', 'fire');
    const base = patch(midGame(), (d) => {
      d.players[0].progress = 1;
      d.players[0].hand = [light];
    });
    const unveiled = act(base, { type: 'unveil', player: 0, ritual: 'meditation' });
    expect(reject(unveiled, { type: 'playCard', player: 0, cardId: light.id })).toContain('看破したターン');
    const played = act(base, { type: 'playCard', player: 0, cardId: light.id });
    expect(reject(played, { type: 'unveil', player: 0, ritual: 'meditation' })).toContain('カードを使ったターン');
  });
});

// -------------------------------------------------------------
// 勝敗
// -------------------------------------------------------------

describe('勝敗', () => {
  it('進行度4で儀式の完成による勝利', () => {
    const s = patch(midGame(), (d) => {
      d.players[0].ritual = 'meditation';
      d.players[0].progress = 3;
    });
    const end = act(s, { type: 'endTurn', player: 0 });
    expect(end.phase).toBe('finished');
    expect(end.result).toEqual({ type: 'win', winner: 0, reason: 'ritualComplete' });
  });

  it('山札が0枚になったターンの終了時に終了し、進行度が高い方の勝ち', () => {
    const s = patch(midGame(), (d) => {
      d.deck = [];
      d.players[0].ritual = 'twinStars';
      d.players[1].progress = 1;
    });
    expect(act(s, { type: 'endTurn', player: 0 }).result).toEqual({ type: 'win', winner: 1, reason: 'deckOut' });
  });

  it('同じターンなら、山札切れより儀式の完成が優先', () => {
    const s = patch(midGame(), (d) => {
      d.deck = [];
      d.players[0].ritual = 'meditation';
      d.players[0].progress = 3;
    });
    expect(act(s, { type: 'endTurn', player: 0 }).result).toEqual({ type: 'win', winner: 0, reason: 'ritualComplete' });
  });

  it('最大ターン数で終了し、同点なら引き分け', () => {
    const s = patch(midGame(), (d) => {
      d.turnNumber = d.config.maxTurns;
      d.players[0].ritual = 'twinStars';
    });
    expect(act(s, { type: 'endTurn', player: 0 }).result).toEqual({ type: 'draw', reason: 'turnLimit' });
  });

  it('終了後は行動できない', () => {
    const s = patch(midGame(), (d) => {
      d.players[0].ritual = 'meditation';
      d.players[0].progress = 3;
    });
    const end = act(s, { type: 'endTurn', player: 0 });
    expect(reject(end, { type: 'endTurn', player: 1 })).toContain('終了');
    expect(getLegalActions(end, 0)).toEqual([]);
    expect(getLegalActions(end, 1)).toEqual([]);
  });
});

// -------------------------------------------------------------
// 見える情報
// -------------------------------------------------------------

describe('見える情報', () => {
  it('相手の儀式・手札・伏せた結界の属性・透視の結果は見えない', () => {
    const barrier = card('barrier', 'fire');
    const cv = card('clairvoyance', 'wind');
    let s = patch(midGame(), (d) => (d.players[0].hand = [barrier, cv]));
    s = act(s, { type: 'playCard', player: 0, cardId: barrier.id });
    s = act(s, { type: 'playCard', player: 0, cardId: cv.id });

    const opp = getPlayerView(s, 1);
    expect(opp.opponent.ritual).toBeNull();
    expect(opp.opponent.handCount).toBe(s.players[0].hand.length);
    expect(opp.opponent.hasBarrier).toBe(true);
    expect(opp).not.toHaveProperty('deck');
    expect(opp.currentTurn.usedCards[0]).toEqual({ id: barrier.id, kind: 'barrier', element: null });
    expect(opp.currentTurn.events.some((e) => e.type === 'clairvoyance')).toBe(false);

    const own = getPlayerView(s, 0);
    expect(own.currentTurn.usedCards[0]).toEqual(barrier);
    expect(own.currentTurn.events.some((e) => e.type === 'clairvoyance')).toBe(true);
  });

  it('相手の遠見の選択待ちは見えない', () => {
    const farsight = card('farsight', 'wind');
    let s = patch(midGame(), (d) => (d.players[0].hand = [farsight]));
    s = act(s, { type: 'playCard', player: 0, cardId: farsight.id });
    expect(getPlayerView(s, 0).pendingChoice).not.toBeNull();
    expect(getPlayerView(s, 1).pendingChoice).toBeNull();
  });
});
