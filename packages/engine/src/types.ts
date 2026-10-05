// =============================================================
// 魔法使いの儀式カードゲーム ルールエンジン 型定義（v0.2）
// 仕様書 docs/ritual_card_game_spec.md に対応
// =============================================================

// -------------------------------------------------------------
// 基本
// -------------------------------------------------------------

/** プレイヤー番号。0 が先攻、1 が後攻。 */
export type PlayerId = 0 | 1;

/**
 * 属性。
 * ※ `Element` という名前は DOM の組み込み型と衝突するため ManaElement とする。
 */
export type ManaElement = 'fire' | 'water' | 'wind' | 'earth';

export const ELEMENTS: readonly ManaElement[] = ['fire', 'water', 'wind', 'earth'];

export const ELEMENT_NAMES: Record<ManaElement, string> = {
  fire: '火',
  water: '水',
  wind: '風',
  earth: '土',
};

// -------------------------------------------------------------
// カード
// -------------------------------------------------------------

export type CardKind =
  | 'manaLight'     // 魔力の灯
  | 'fountain'      // 知識の泉
  | 'farsight'      // 遠見
  | 'transmute'     // 錬成
  | 'ritualBreak'   // 術式干渉
  | 'seal'          // 封印
  | 'manaStorm'     // 魔力乱流
  | 'barrier'       // 結界
  | 'clairvoyance'; // 透視

export type CardCategory = 'basic' | 'support' | 'disrupt' | 'defense' | 'info';

/** 山札の中の1枚。同じ種類・属性のカードが複数あるため、id で個体を区別する。 */
export interface Card {
  readonly id: string;
  readonly kind: CardKind;
  readonly element: ManaElement;
}

export interface CardDef {
  readonly name: string;
  readonly category: CardCategory;
  readonly description: string;
}

export const CARD_DEFS: Record<CardKind, CardDef> = {
  manaLight:    { name: '魔力の灯', category: 'basic',   description: '効果なし' },
  fountain:     { name: '知識の泉', category: 'support', description: 'カードを1枚引く' },
  farsight:     { name: '遠見',     category: 'support', description: '山札の上3枚を見て、好きな順に戻す' },
  transmute:    { name: '錬成',     category: 'support', description: '手札を1枚捨て、2枚引く' },
  ritualBreak:  { name: '術式干渉', category: 'disrupt', description: '相手の進行度を1下げる' },
  seal:         { name: '封印',     category: 'disrupt', description: '相手の次のターン、進行度が上がらない' },
  manaStorm:    { name: '魔力乱流', category: 'disrupt', description: '相手の手札をランダムに1枚捨てさせる' },
  barrier:      { name: '結界',     category: 'defense', description: '場に伏せて設置し、相手の妨害を1回無効化する' },
  clairvoyance: { name: '透視',     category: 'info',    description: '相手の儀式ではない儀式を2つ知る' },
};

/** 山札の構成（仕様書 9章の配分表と対応。合計60枚） */
export const DECK_COMPOSITION: Record<CardKind, Record<ManaElement, number>> = {
  manaLight:    { fire: 3, water: 3, wind: 3, earth: 3 },
  fountain:     { fire: 1, water: 3, wind: 2, earth: 2 },
  farsight:     { fire: 1, water: 2, wind: 4, earth: 1 },
  transmute:    { fire: 2, water: 3, wind: 1, earth: 2 },
  ritualBreak:  { fire: 3, water: 1, wind: 1, earth: 1 },
  seal:         { fire: 1, water: 1, wind: 0, earth: 2 },
  manaStorm:    { fire: 2, water: 1, wind: 1, earth: 0 },
  barrier:      { fire: 1, water: 1, wind: 1, earth: 3 },
  clairvoyance: { fire: 1, water: 0, wind: 2, earth: 1 },
};

// -------------------------------------------------------------
// 儀式
// -------------------------------------------------------------

export type RitualCategory = 'element' | 'action' | 'opponent';

export type RitualId =
  // 属性系
  | 'infernoSummon'    // 業火の召喚
  | 'abyssalTide'      // 深淵の潮
  | 'elementalHarmony' // 四元素の調和
  | 'twinStars'        // 双子星の儀
  | 'galeHerald'       // 疾風の先触れ
  // 行動系
  | 'meditation'       // 瞑想
  | 'serenePrayer'     // 静謐の祈り
  | 'stargazing'       // 星読みの儀
  | 'offering'         // 供物の儀
  | 'malediction'      // 呪詛の儀
  // 相手依存系
  | 'mirrorImage'      // 写し身の儀
  | 'shadowStitch'     // 影縫いの儀
  | 'mimicry';         // 追従の儀

export interface RitualDef {
  readonly name: string;
  readonly category: RitualCategory;
  readonly description: string;
}

export const RITUAL_DEFS: Record<RitualId, RitualDef> = {
  infernoSummon:    { name: '業火の召喚',   category: 'element',  description: '火のカードを1枚以上使う' },
  abyssalTide:      { name: '深淵の潮',     category: 'element',  description: '水のカードを2枚使う' },
  elementalHarmony: { name: '四元素の調和', category: 'element',  description: '異なる属性のカードを2枚使う' },
  twinStars:        { name: '双子星の儀',   category: 'element',  description: '同じ属性のカードを2枚使う' },
  galeHerald:       { name: '疾風の先触れ', category: 'element',  description: 'そのターン最初に使うカードが風' },
  meditation:       { name: '瞑想',       category: 'action',   description: 'カードを1枚も使わない' },
  serenePrayer:     { name: '静謐の祈り',   category: 'action',   description: 'ちょうど1枚だけカードを使う' },
  stargazing:       { name: '星読みの儀',   category: 'action',   description: '山札を見る効果を使う' },
  offering:         { name: '供物の儀',     category: 'action',   description: 'カードを捨てる効果を使う' },
  malediction:      { name: '呪詛の儀',     category: 'action',   description: '妨害カードを使う' },
  mirrorImage:      { name: '写し身の儀',   category: 'opponent', description: '相手が直前のターンに使った属性と同じ属性のカードを使う' },
  shadowStitch:     { name: '影縫いの儀',   category: 'opponent', description: '相手が直前のターンに使わなかった属性のカードを使う' },
  mimicry:          { name: '追従の儀',     category: 'opponent', description: '相手が直前のターンに使った枚数と同じ枚数のカードを使う' },
};

export const RITUAL_IDS = Object.keys(RITUAL_DEFS) as RitualId[];

// -------------------------------------------------------------
// ターンの記録
// -------------------------------------------------------------

/**
 * カード効果や看破で起きた出来事。usedCards からは分からない結果を行動ログと CPU の推理に残す。
 * 相手に見せてよいかは getPlayerView で出来事ごとに振り分ける。
 */
export type TurnEvent =
  | { readonly type: 'cardsDrawn';      readonly player: PlayerId; readonly count: number }
  | { readonly type: 'disruptBlocked';  readonly target: PlayerId; readonly card: Card }
  | { readonly type: 'progressReduced'; readonly target: PlayerId; readonly amount: number }
  | { readonly type: 'sealApplied';     readonly target: PlayerId }
  | { readonly type: 'handDiscarded';   readonly target: PlayerId; readonly card: Card }
  | { readonly type: 'deckTopArranged'; readonly player: PlayerId; readonly count: number }
  /** 透視の結果。本人にだけ見せる */
  | { readonly type: 'clairvoyance';    readonly player: PlayerId; readonly rituals: readonly RitualId[] }
  | { readonly type: 'unveil';          readonly player: PlayerId; readonly ritual: RitualId; readonly success: boolean };

/**
 * 1ターン中に起きたことの記録。儀式の判定と行動ログの両方に使う。
 * 「遠見を使ったか」「妨害を使ったか」などは usedCards から導けるため、ここには持たせない。
 */
export interface TurnRecord {
  readonly player: PlayerId;
  readonly turnNumber: number;
  /** 使った順に並べる（疾風の先触れの判定に順番が必要） */
  readonly usedCards: readonly Card[];
  /** このターンに看破を行ったか */
  readonly unveiled: boolean;
  /** このターン終了時に進行度が上がったか */
  readonly progressed: boolean;
  readonly events: readonly TurnEvent[];
}

// -------------------------------------------------------------
// プレイヤーの状態
// -------------------------------------------------------------

export interface PlayerState {
  /** 選んだ儀式。選択前は null */
  readonly ritual: RitualId | null;
  /** 準備段階で提示された3つの候補 */
  readonly ritualCandidates: readonly RitualId[];
  /** 看破されて儀式が公開済みか */
  readonly ritualRevealed: boolean;
  readonly hand: readonly Card[];
  readonly progress: number;
  /** 設置中の結界（最大1枚） */
  readonly barrier: Card | null;
  /** 封印状態：次の自分のターン終了時、進行度が上がらない */
  readonly sealed: boolean;
  /** 看破を使用済みか */
  readonly unveilUsed: boolean;
  /** 透視で「相手の儀式ではない」と分かった儀式 */
  readonly excludedRituals: readonly RitualId[];
}

// -------------------------------------------------------------
// 保留中の選択
// -------------------------------------------------------------

/**
 * カード効果の途中で、プレイヤーの選択を待っている状態。
 * 今のところ遠見（山札の上を並べ替える）のみ。
 */
export type PendingChoice = {
  readonly type: 'arrangeDeckTop';
  readonly player: PlayerId;
  readonly cards: readonly Card[];
};

// -------------------------------------------------------------
// ゲーム全体の状態
// -------------------------------------------------------------

export type GamePhase = 'ritualSelection' | 'playing' | 'finished';

export type GameResult =
  | { readonly type: 'win'; readonly winner: PlayerId; readonly reason: 'ritualComplete' | 'deckOut' | 'turnLimit' }
  | { readonly type: 'draw'; readonly reason: 'deckOut' | 'turnLimit' };

export interface GameState {
  /** この対戦のルール設定（対戦中は変えない） */
  readonly config: GameConfig;
  readonly phase: GamePhase;
  readonly players: readonly [PlayerState, PlayerState];
  /** 山札。配列の先頭が一番上 */
  readonly deck: readonly Card[];
  readonly discard: readonly Card[];
  readonly currentPlayer: PlayerId;
  /** 1 から数える（先攻の最初のターン = 1） */
  readonly turnNumber: number;
  /** 進行中のターンの記録 */
  readonly currentTurn: TurnRecord;
  /** 終了したターンの記録 */
  readonly history: readonly TurnRecord[];
  readonly pendingChoice: PendingChoice | null;
  readonly result: GameResult | null;
  /** シード付き乱数の現在値（同じ対戦を再現するため） */
  readonly rngState: number;
}

// -------------------------------------------------------------
// プレイヤーから見える情報
// -------------------------------------------------------------

/** 相手が伏せた結界。種類と個体は分かるが属性は分からない */
export interface HiddenBarrier {
  readonly id: string;
  readonly kind: 'barrier';
  readonly element: null;
}

export type VisibleCard = Card | HiddenBarrier;

export interface TurnRecordView extends Omit<TurnRecord, 'usedCards'> {
  readonly usedCards: readonly VisibleCard[];
}

export interface OpponentView {
  /** 看破で公開済みのときだけ値が入る */
  readonly ritual: RitualId | null;
  readonly ritualRevealed: boolean;
  readonly handCount: number;
  readonly progress: number;
  readonly hasBarrier: boolean;
  readonly sealed: boolean;
  readonly unveilUsed: boolean;
}

/**
 * 1人のプレイヤーに見えてよい情報だけを集めたもの。
 * CPU にはこれだけを渡し、オンライン対戦ではサーバーからアプリへこれだけを送る。
 */
export interface PlayerView {
  readonly me: PlayerId;
  readonly config: GameConfig;
  readonly phase: GamePhase;
  readonly self: PlayerState;
  readonly opponent: OpponentView;
  readonly deckCount: number;
  readonly discard: readonly Card[];
  readonly currentPlayer: PlayerId;
  readonly turnNumber: number;
  readonly currentTurn: TurnRecordView;
  readonly history: readonly TurnRecordView[];
  /** 自分の選択待ちのときだけ値が入る */
  readonly pendingChoice: PendingChoice | null;
  readonly result: GameResult | null;
}

// -------------------------------------------------------------
// プレイヤーの行動
// -------------------------------------------------------------

export type Action =
  | { readonly type: 'selectRitual';   readonly player: PlayerId; readonly ritual: RitualId }
  | {
      readonly type: 'playCard';
      readonly player: PlayerId;
      readonly cardId: string;
      /** 錬成で捨てる手札の id（錬成以外では不要） */
      readonly discardCardId?: string;
    }
  | { readonly type: 'arrangeDeckTop'; readonly player: PlayerId; readonly orderedCardIds: readonly string[] }
  | { readonly type: 'unveil';         readonly player: PlayerId; readonly ritual: RitualId }
  | { readonly type: 'endTurn';        readonly player: PlayerId };

// -------------------------------------------------------------
// ルールの設定値（調整しやすいよう1か所にまとめる）
// -------------------------------------------------------------

export interface GameConfig {
  /** 補充後の手札枚数 */
  readonly handSize: number;
  /** 1ターンに使えるカードの最大枚数 */
  readonly maxCardsPerTurn: number;
  /** 先攻の最初のターンに使えるカードの最大枚数 */
  readonly firstTurnMaxCards: number;
  /** 儀式の完成ライン */
  readonly goalProgress: number;
  /** 看破成功時に相手の進行度を下げる量 */
  readonly unveilSuccessPenalty: number;
  /** 看破失敗時に自分の進行度を下げる量 */
  readonly unveilFailPenalty: number;
  /** 看破を使うのに必要な自分の進行度 */
  readonly unveilMinProgress: number;
  /** 最大ターン数（両者の合計）。このターンの終了時にゲーム終了 */
  readonly maxTurns: number;
  /** 遠見で見る枚数 */
  readonly farsightCount: number;
  /** 透視で知る儀式の数 */
  readonly clairvoyanceCount: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  handSize: 5,
  maxCardsPerTurn: 2,
  firstTurnMaxCards: 1,
  goalProgress: 4,
  unveilSuccessPenalty: 2,
  unveilFailPenalty: 1,
  unveilMinProgress: 1,
  maxTurns: 40,
  farsightCount: 3,
  clairvoyanceCount: 2,
};
