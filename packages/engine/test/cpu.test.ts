import { describe, expect, it } from 'vitest';
import { createCpu } from '../src/cpu/cpu';
import type { CpuLevel } from '../src/cpu/cpu';
import { inferOpponentRituals } from '../src/cpu/deduction';
import { opponentOf } from '../src/engine';
import { playMatch } from '../src/match';
import { newTurnRecord } from '../src/setup';
import { getPlayerView } from '../src/view';
import { BALANCE_VARIANTS } from '../src/variants';
import type { Card, GameState, TurnEvent, TurnRecord } from '../src/types';
import { card, midGame, patch } from './helpers';

/** プレイヤー1（相手）の終了したターンを1つ記録した状態を、プレイヤー0から見る */
function viewAfterOpponentTurn(usedCards: Card[], progressed: boolean, myPrevEvents: TurnEvent[] = []) {
  const history: TurnRecord[] = [
    { ...newTurnRecord(0, 1), events: myPrevEvents },
    { ...newTurnRecord(1, 2), usedCards, progressed },
  ];
  const s = patch(midGame(), (d) => {
    d.history = history as typeof d.history;
  });
  return inferOpponentRituals(getPlayerView(s, 0));
}

describe('相手の儀式の推理', () => {
  it('条件を満たしたのに進行度が上がらなかった儀式は消える', () => {
    const probs = viewAfterOpponentTurn([card('manaLight', 'fire')], false);
    expect(probs.has('infernoSummon')).toBe(false);
    expect(probs.has('serenePrayer')).toBe(false);
    expect(probs.has('meditation')).toBe(true);
  });

  it('進行度が上がったら、条件を満たさない儀式は消える', () => {
    const probs = viewAfterOpponentTurn([card('manaLight', 'fire')], true);
    expect(probs.has('infernoSummon')).toBe(true);
    expect(probs.has('serenePrayer')).toBe(true);
    expect(probs.has('abyssalTide')).toBe(false);
    expect(probs.has('meditation')).toBe(false);
  });

  it('伏せた結界の属性は分からないので、どの属性の可能性も残す', () => {
    const probs = viewAfterOpponentTurn([card('barrier', 'fire')], true);
    expect(probs.has('infernoSummon')).toBe(true);
    expect(probs.has('galeHerald')).toBe(true);
    expect(probs.has('twinStars')).toBe(false);
  });

  it('封印が効いていたターンは手がかりにしない', () => {
    const sealed: TurnEvent[] = [{ type: 'sealApplied', target: 1 }];
    const probs = viewAfterOpponentTurn([card('manaLight', 'fire')], false, sealed);
    expect(probs.has('infernoSummon')).toBe(true);
  });

  it('透視で除外した儀式は消え、確率の合計は1', () => {
    const s = patch(midGame(), (d) => (d.players[0].excludedRituals = ['meditation', 'mimicry']));
    const probs = inferOpponentRituals(getPlayerView(s, 0));
    expect(probs.has('meditation')).toBe(false);
    expect(probs.has('mimicry')).toBe(false);
    expect([...probs.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe('CPU 同士の対戦', () => {
  const LEVELS: CpuLevel[] = ['easy', 'normal', 'hard'];

  /** 推理が本当の儀式を誤って消していないか */
  function checkDeduction(s: GameState): void {
    if (s.phase !== 'playing') return;
    for (const me of [0, 1] as const) {
      const truth = s.players[opponentOf(me)].ritual!;
      expect(inferOpponentRituals(getPlayerView(s, me)).has(truth)).toBe(true);
    }
  }

  for (const a of LEVELS) {
    for (const b of LEVELS) {
      it(`${a} 対 ${b}：100局が正常に終わり、推理は本当の儀式を消さない`, () => {
        for (let seed = 0; seed < 100; seed++) {
          const s = playMatch({
            seed,
            cpus: [createCpu(a, seed * 2 + 1), createCpu(b, seed * 2 + 2)],
            onStep: checkDeduction,
          });
          expect(s.result).not.toBeNull();
        }
      }, 60_000);
    }
  }

  for (const variant of ['v0.2', 'proposal', 'proposal2', 'proposal3', 'proposal3-kind'] as const) {
    for (const level of LEVELS) {
      it(`${BALANCE_VARIANTS[variant].label}のルールで ${level} 同士：100局が正常に終わり、推理は本当の儀式を消さない`, () => {
        for (let seed = 0; seed < 100; seed++) {
          const s = playMatch({
            seed,
            config: BALANCE_VARIANTS[variant].config,
            cpus: [createCpu(level, seed * 2 + 1), createCpu(level, seed * 2 + 2)],
            onStep: checkDeduction,
          });
          expect(s.result).not.toBeNull();
        }
      }, 60_000);
    }
  }
});
