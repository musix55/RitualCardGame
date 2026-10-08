import { describe, expect, it } from 'vitest';
import { opponentRitualStatuses, ownRitualMetNow } from '../src/assist';
import { createCpu } from '../src/cpu/cpu';
import { inferOpponentRituals } from '../src/cpu/deduction';
import { opponentOf } from '../src/engine';
import { nextActor, stepCpu } from '../src/match';
import { createGame } from '../src/setup';
import { getPlayerView } from '../src/view';
import type { GameState } from '../src/types';
import { act, card, midGame, patch } from './helpers';

/** CPU 同士の1局を1手ずつ進め、各手の前の状態と行動を検査する */
function eachStep(seed: number, check: (before: GameState, after: GameState) => void): void {
  let s = createGame(seed);
  const cpus = [createCpu('normal', seed * 2 + 1), createCpu('hard', seed * 2 + 2)] as const;
  while (s.phase !== 'finished') {
    const { state } = stepCpu(s, cpus[nextActor(s)]);
    check(s, state);
    s = state;
  }
}

describe('推理メモ', () => {
  it('本当の儀式を候補から外さず、候補の数は CPU の推理と一致する', () => {
    for (let seed = 0; seed < 40; seed++) {
      eachStep(seed, (_, s) => {
        if (s.phase === 'ritualSelection') return;
        for (const me of [0, 1] as const) {
          const view = getPlayerView(s, me);
          const statuses = opponentRitualStatuses(view);
          const truth = s.players[opponentOf(me)].ritual!;
          expect(['possible', 'revealed']).toContain(statuses.get(truth)!.type);
          const remaining = [...statuses.values()].filter((st) => st.type === 'possible' || st.type === 'revealed');
          expect(remaining.length).toBe(inferOpponentRituals(view).size);
        }
      });
    }
  });

  it('矛盾した儀式には、その理由になったターンが付く', () => {
    let s = patch(midGame(), (d) => {
      d.players[0].ritual = 'meditation';
      d.players[0].hand = [card('manaLight', 'earth')];
      d.players[1].ritual = 'meditation';
      d.players[1].hand = [card('manaLight', 'fire')];
    });
    s = act(s, { type: 'endTurn', player: 0 });
    s = act(s, { type: 'playCard', player: 1, cardId: s.players[1].hand.find((c) => c.kind === 'manaLight' && c.element === 'fire')!.id });
    s = act(s, { type: 'endTurn', player: 1 });
    // 相手は火を使ったのに進行度が上がらなかった → 業火の召喚ではない
    const st = opponentRitualStatuses(getPlayerView(s, 0)).get('infernoSummon')!;
    expect(st.type).toBe('contradiction');
    if (st.type === 'contradiction') expect(st.turn.turnNumber).toBe(4);
  });

  it('透視で除外した儀式と、公開済みの場合を区別する', () => {
    const excluded = patch(midGame(), (d) => (d.players[0].excludedRituals = ['mimicry']));
    expect(opponentRitualStatuses(getPlayerView(excluded, 0)).get('mimicry')).toEqual({ type: 'clairvoyance' });

    const revealed = patch(midGame(), (d) => {
      d.players[1].ritual = 'twinStars';
      d.players[1].ritualRevealed = true;
    });
    const statuses = opponentRitualStatuses(getPlayerView(revealed, 0));
    expect(statuses.get('twinStars')).toEqual({ type: 'revealed' });
    expect(statuses.get('meditation')).toEqual({ type: 'otherRevealed' });
  });
});

describe('自分の儀式の達成状況', () => {
  it('カードを使うたびに変わる', () => {
    const fire = card('manaLight', 'fire');
    let s = patch(midGame(), (d) => {
      d.players[0].ritual = 'infernoSummon';
      d.players[0].hand = [fire, card('manaLight', 'water')];
    });
    expect(ownRitualMetNow(getPlayerView(s, 0))).toBe(false);
    s = act(s, { type: 'playCard', player: 0, cardId: fire.id });
    expect(ownRitualMetNow(getPlayerView(s, 0))).toBe(true);
  });

  it('自分の手番以外と、儀式の選択前は null', () => {
    expect(ownRitualMetNow(getPlayerView(midGame(), 1))).toBeNull();
    expect(ownRitualMetNow(getPlayerView(createGame(1), 0))).toBeNull();
  });

  it('ターン終了の直前の表示は、実際の判定と一致する（封印中を除く）', () => {
    for (let seed = 0; seed < 40; seed++) {
      eachStep(seed, (before, after) => {
        if (before.phase !== 'playing' || after.history.length === before.history.length) return;
        const player = before.currentPlayer;
        if (before.players[player].sealed) return;
        expect(ownRitualMetNow(getPlayerView(before, player))).toBe(after.history.at(-1)!.progressed);
      });
    }
  });
});
