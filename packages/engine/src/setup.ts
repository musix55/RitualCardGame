// =============================================================
// ゲームの準備（仕様書 4章）
// =============================================================

import { DECK_COMPOSITION, DEFAULT_CONFIG, ELEMENTS, RITUAL_DEFS, RITUAL_IDS } from './types';
import type { Card, CardKind, GameConfig, GameState, PlayerId, PlayerState, RitualCategory, RitualId, TurnRecord } from './types';
import { randomInt, shuffle } from './rng';
import type { RngHolder } from './rng';

const RITUAL_CATEGORIES: readonly RitualCategory[] = ['element', 'action', 'opponent'];

/** シャッフル前の山札60枚。id は「種類-属性-連番」 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const kind of Object.keys(DECK_COMPOSITION) as CardKind[]) {
    for (const element of ELEMENTS) {
      for (let i = 1; i <= DECK_COMPOSITION[kind][element]; i++) {
        deck.push({ id: `${kind}-${element}-${i}`, kind, element });
      }
    }
  }
  return deck;
}

export function newTurnRecord(player: PlayerId, turnNumber: number): TurnRecord {
  return { player, turnNumber, usedCards: [], unveiled: false, progressed: false, events: [] };
}

/** 属性系・行動系・相手依存系から1つずつ抽選する */
function drawRitualCandidates(rng: RngHolder): RitualId[] {
  return RITUAL_CATEGORIES.map((category) => {
    const pool = RITUAL_IDS.filter((r) => RITUAL_DEFS[r].category === category);
    return pool[randomInt(rng, pool.length)]!;
  });
}

/**
 * 新しい対戦を作る。儀式の選択待ち（phase: 'ritualSelection'）から始まる。
 * プレイヤー0が先攻。先攻・後攻のランダムな割り当ては呼び出し側（アプリ・サーバー）で行う。
 */
export function createGame(seed: number, config: GameConfig = DEFAULT_CONFIG): GameState {
  const rng: RngHolder = { rngState: seed >>> 0 };
  const deck = createDeck();
  shuffle(rng, deck);

  const newPlayer = (): PlayerState => ({
    ritual: null,
    ritualCandidates: drawRitualCandidates(rng),
    ritualRevealed: false,
    hand: deck.splice(0, config.handSize),
    progress: 0,
    barrier: null,
    sealed: false,
    unveilUsed: false,
    excludedRituals: [],
  });
  const players: [PlayerState, PlayerState] = [newPlayer(), newPlayer()];

  return {
    config,
    phase: 'ritualSelection',
    players,
    deck,
    discard: [],
    currentPlayer: 0,
    turnNumber: 1,
    currentTurn: newTurnRecord(0, 1),
    history: [],
    pendingChoice: null,
    result: null,
    rngState: rng.rngState,
  };
}
