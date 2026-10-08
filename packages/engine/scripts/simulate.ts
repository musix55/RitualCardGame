// =============================================================
// CPU 同士の自動対戦による数値の集計（仕様書 12章）
//
// 使い方（ルートで実行）:
//   npm run sim
//   npm run sim -- --games 5000 --variant current,proposal --levels hard,hard --goal 3,4,5
//
// オプション:
//   --games N         1設定あたりの対戦数（既定 10000）
//   --variant a,b     比べるルールの組み合わせ（src/variants.ts。既定 current,v0.2）
//   --levels a,b      先攻,後攻 の CPU の強さ easy|normal|hard（既定 normal,normal）
//   --goal 3,4,5      完成ライン。複数指定すると完成ラインごとに比較する（既定 4）
//   --seed N          最初のシード（既定 1）。設定が違っても同じシードの並びで対戦する
//   --sec-per-turn N  1ターンの想定秒数。ゲーム時間の目安の計算に使う（既定 15）
// =============================================================

import { BALANCE_VARIANTS, createCpu, judgeRitual, playMatch, RITUAL_DEFS, RITUAL_IDS } from '../src/index';
import type { BalanceVariantId, CpuLevel, GameConfig, GameState, RitualId, TurnRecord } from '../src/index';

// -------------------------------------------------------------
// 引数
// -------------------------------------------------------------

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const GAMES = Number(arg('games', '10000'));
const VARIANTS = arg('variant', 'current,v0.2').split(',') as BalanceVariantId[];
const LEVELS = arg('levels', 'normal,normal').split(',') as [CpuLevel, CpuLevel];
const GOALS = arg('goal', '4').split(',').map(Number);
const SEED = Number(arg('seed', '1'));
const SEC_PER_TURN = Number(arg('sec-per-turn', '15'));

for (const v of VARIANTS) {
  if (!(v in BALANCE_VARIANTS)) {
    console.error(`不明な --variant: ${v}（使えるもの: ${Object.keys(BALANCE_VARIANTS).join(', ')}）`);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// 集計
// -------------------------------------------------------------

interface RitualStats {
  /** その儀式を選んだ延べ人数と勝利数 */
  picks: number;
  wins: number;
  /** 自分のターン数と、そのうち条件を満たしたターン数（満たしやすさ） */
  turns: number;
  met: number;
  /** 相手の看破で当てられた人数（読まれやすさ） */
  unveiled: number;
}

interface Stats {
  games: number;
  turns: number;
  reasons: Record<string, number>;
  firstWins: number;
  secondWins: number;
  draws: number;
  rituals: Record<RitualId, RitualStats>;
  unveilUsed: number;
  unveilSuccess: number;
  unveilTurnSum: number;
}

const REASON_NAMES = { ritualComplete: '儀式の完成', deckOut: '山札切れ', turnLimit: '最大ターン数' } as const;

function emptyStats(): Stats {
  return {
    games: 0,
    turns: 0,
    reasons: {},
    firstWins: 0,
    secondWins: 0,
    draws: 0,
    rituals: Object.fromEntries(
      RITUAL_IDS.map((r) => [r, { picks: 0, wins: 0, turns: 0, met: 0, unveiled: 0 }]),
    ) as Record<RitualId, RitualStats>,
    unveilUsed: 0,
    unveilSuccess: 0,
    unveilTurnSum: 0,
  };
}

function record(stats: Stats, s: GameState): void {
  const result = s.result!;
  stats.games++;
  stats.turns += s.turnNumber;
  const reasonKey = `${result.type === 'win' ? '勝敗' : '引き分け'}・${REASON_NAMES[result.reason]}`;
  stats.reasons[reasonKey] = (stats.reasons[reasonKey] ?? 0) + 1;

  if (result.type === 'draw') stats.draws++;
  else if (result.winner === 0) stats.firstWins++;
  else stats.secondWins++;

  s.players.forEach((p, i) => {
    const r = stats.rituals[p.ritual!];
    r.picks++;
    if (result.type === 'win' && result.winner === i) r.wins++;
    if (p.ritualRevealed) r.unveiled++;
  });

  const lastOwn: [TurnRecord | null, TurnRecord | null] = [null, null];
  s.history.forEach((t, i) => {
    // 条件の満たしやすさ（封印で上がらなかったターンも「満たした」に数える）
    const ritual = s.players[t.player].ritual!;
    const prev = i > 0 ? s.history[i - 1]! : null;
    const ctx = { turn: t, opponentPrev: prev && prev.player !== t.player ? prev : null, ownPrev: lastOwn[t.player] };
    const r = stats.rituals[ritual];
    r.turns++;
    if (judgeRitual(ritual, ctx, s.config.ritualRules)) r.met++;
    lastOwn[t.player] = t;

    for (const e of t.events) {
      if (e.type !== 'unveil') continue;
      stats.unveilUsed++;
      stats.unveilTurnSum += t.turnNumber;
      if (e.success) stats.unveilSuccess++;
    }
  });
}

function run(config: GameConfig): Stats {
  const stats = emptyStats();
  for (let i = 0; i < GAMES; i++) {
    const seed = SEED + i;
    const cpus = [createCpu(LEVELS[0], seed * 2 + 1), createCpu(LEVELS[1], seed * 2 + 2)] as const;
    record(stats, playMatch({ seed, config, cpus }));
  }
  return stats;
}

// -------------------------------------------------------------
// 表示
// -------------------------------------------------------------

const ratio = (n: number, d: number) => (d === 0 ? NaN : n / d);
const pct = (x: number) => (Number.isNaN(x) ? '-' : `${(x * 100).toFixed(1)}%`);
const winRate = (r: RitualStats) => ratio(r.wins, r.picks);

/** 表の1行。見出しの列は全角で揃え、数値の列は右寄せにする */
function row(head: string, cells: readonly string[], width = 22): string {
  return `  ${head.padEnd(9, '　')}${cells.map((c) => c.padStart(width)).join('')}`;
}

function summaryRows(results: readonly Stats[]): void {
  const metric = (head: string, f: (st: Stats) => string) => console.log(row(head, results.map(f)));
  metric('平均ターン数', (st) => {
    const avg = st.turns / st.games;
    return `${avg.toFixed(1)}（約${((avg * SEC_PER_TURN) / 60).toFixed(1)}分）`;
  });
  metric('先攻の勝率', (st) => pct(ratio(st.firstWins, st.games)));
  metric('後攻の勝率', (st) => pct(ratio(st.secondWins, st.games)));
  metric('引き分け', (st) => pct(ratio(st.draws, st.games)));
  for (const reason of Object.values(REASON_NAMES)) {
    metric(`${reason}で終了`, (st) => {
      const n = Object.entries(st.reasons).filter(([k]) => k.endsWith(reason)).reduce((a, [, v]) => a + v, 0);
      return pct(ratio(n, st.games));
    });
  }
  metric('看破の使用率', (st) => pct(ratio(st.unveilUsed, st.games * 2)));
  metric('看破の成功率', (st) => pct(ratio(st.unveilSuccess, st.unveilUsed)));
  metric('看破の平均ターン', (st) => (st.unveilUsed ? (st.unveilTurnSum / st.unveilUsed).toFixed(1) : '-'));
  metric('儀式の勝率の幅', (st) => {
    const rates = RITUAL_IDS.map((r) => winRate(st.rituals[r]));
    return `${pct(Math.min(...rates))}〜${pct(Math.max(...rates))}`;
  });
  metric('40〜60%の儀式数', (st) => {
    const n = RITUAL_IDS.filter((r) => winRate(st.rituals[r]) >= 0.4 && winRate(st.rituals[r]) <= 0.6).length;
    return `${n} / ${RITUAL_IDS.length}`;
  });
}

function ritualRows(results: readonly Stats[], configs: readonly GameConfig[]): void {
  console.log('\n儀式ごと（勝率 / 達成率 / 被看破率）。＊の後の数字は、その儀式で使った調整案の番号（＊1 は第1案）\n');
  console.log(row('', VARIANTS.map((v) => BALANCE_VARIANTS[v].label), 26));
  for (const r of RITUAL_IDS) {
    const cells = results.map((st, i) => {
      const x = st.rituals[r];
      const rule = configs[i]!.ritualRules[r];
      const mark = rule ? `＊${rule.slice(-1)} ` : '';
      return `${mark}${pct(winRate(x))} / ${pct(ratio(x.met, x.turns))} / ${pct(ratio(x.unveiled, x.picks))}`;
    });
    console.log(row(RITUAL_DEFS[r].name, cells, 26));
  }
}

// -------------------------------------------------------------
// 実行
// -------------------------------------------------------------

console.log(`# CPU 同士の自動対戦（先攻 ${LEVELS[0]} / 後攻 ${LEVELS[1]}、各設定 ${GAMES}局）`);
for (const goal of GOALS) {
  const started = Date.now();
  const configs: GameConfig[] = VARIANTS.map((v) => ({ ...BALANCE_VARIANTS[v].config, goalProgress: goal }));
  const results = configs.map(run);

  console.log(`\n## 完成ライン ${goal}\n`);
  console.log(row('', VARIANTS.map((v) => BALANCE_VARIANTS[v].label)));
  summaryRows(results);
  ritualRows(results, configs);
  console.log(`\n（集計時間 ${((Date.now() - started) / 1000).toFixed(1)}秒）`);
}
