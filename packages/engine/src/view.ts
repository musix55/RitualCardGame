// =============================================================
// プレイヤーから見える情報（仕様書 11章：不正な覗き見の防止）
// =============================================================

import type { GameState, PlayerId, PlayerView, TurnRecord, TurnRecordView, VisibleCard } from './types';
import { opponentOf } from './engine';

/** 相手が伏せた結界の属性を隠し、相手だけが知る出来事（透視の結果）を除く */
function viewTurn(turn: TurnRecord, me: PlayerId): TurnRecordView {
  if (turn.player === me) return turn;
  const usedCards: VisibleCard[] = turn.usedCards.map((c) =>
    c.kind === 'barrier' ? { id: c.id, kind: 'barrier', element: null } : c,
  );
  const events = turn.events.filter((e) => e.type !== 'clairvoyance');
  return { ...turn, usedCards, events };
}

export function getPlayerView(s: GameState, me: PlayerId): PlayerView {
  const opp = s.players[opponentOf(me)];
  return {
    me,
    config: s.config,
    phase: s.phase,
    self: s.players[me],
    opponent: {
      ritual: opp.ritualRevealed ? opp.ritual : null,
      ritualRevealed: opp.ritualRevealed,
      handCount: opp.hand.length,
      progress: opp.progress,
      hasBarrier: opp.barrier !== null,
      sealed: opp.sealed,
      unveilUsed: opp.unveilUsed,
    },
    deckCount: s.deck.length,
    discard: s.discard,
    currentPlayer: s.currentPlayer,
    turnNumber: s.turnNumber,
    currentTurn: viewTurn(s.currentTurn, me),
    history: s.history.map((t) => viewTurn(t, me)),
    pendingChoice: s.pendingChoice?.player === me ? s.pendingChoice : null,
    result: s.result,
  };
}
