import { applyAction } from '../src/engine';
import { createGame } from '../src/setup';
import type { Action, Card, CardKind, GameState, ManaElement } from '../src/types';

/** 2要素の組（players）は組のまま、配列は配列のまま、読み取り専用を外す */
type Writable<T> = T extends readonly [infer A, infer B]
  ? [Writable<A>, Writable<B>]
  : T extends readonly (infer U)[]
    ? Writable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Writable<T[K]> }
      : T;

/** 状態を複製して書き換える（テストで特定の局面を作るため） */
export function patch(s: GameState, f: (d: Writable<GameState>) => void): GameState {
  const d = structuredClone(s) as unknown as Writable<GameState>;
  f(d);
  return d as unknown as GameState;
}

/** 行動を適用する。失敗したらテストを落とす */
export function act(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`行動が失敗しました: ${r.error} (${JSON.stringify(a)})`);
  return r.state;
}

/** 行動が失敗することを確かめ、理由を返す */
export function reject(s: GameState, a: Action): string {
  const r = applyAction(s, a);
  if (r.ok) throw new Error(`行動が成功してしまいました: ${JSON.stringify(a)}`);
  return r.error;
}

let nextId = 0;
export function card(kind: CardKind, element: ManaElement): Card {
  return { id: `t-${kind}-${element}-${nextId++}`, kind, element };
}

/** 両者が候補の1つ目を選び、先攻の最初のターンが始まった状態 */
export function startedGame(seed = 1): GameState {
  let s = createGame(seed);
  s = act(s, { type: 'selectRitual', player: 0, ritual: s.players[0].ritualCandidates[0]! });
  s = act(s, { type: 'selectRitual', player: 1, ritual: s.players[1].ritualCandidates[0]! });
  return s;
}

/** 先攻の最初のターン（使用1枚制限）を避けるため、ターン番号を進めた状態 */
export function midGame(seed = 1): GameState {
  return patch(startedGame(seed), (d) => {
    d.turnNumber = 3;
    d.currentTurn.turnNumber = 3;
  });
}
