/**
 * 경기 화면의 파생값 — 최근 경기 행·스코어보드 행·골드 추이·킬 지도 점·빌드 오더·경향 표.
 * 전부 순수 함수다. 전역 store 를 읽지 않는다 — 컴포넌트가 payload 조각을 넘기고 테스트는
 * 작은 객체를 넘긴다. 옛 renderMatches·scoreboard·goldChart·killMap·renderFun(legacy/index.html)
 * 의 계산 규칙만 옮겼고 마크업은 컴포넌트에서 한다.
 *
 * ⚠️ `gold_diff` 는 **항상 블루(팀 0, team_id 100) − 레드** 다. 이긴 팀 기준이 아니다 — 경기마다
 *    기준이 바뀌면 여러 판을 나란히 못 본다. 차트는 어느 쪽이 어느 팀인지 글자로 적는다.
 * ⚠️ 킬 지도의 `a`(잡은 멤버 pid)가 0 이면 처형(포탑·미니언)이다. 빈칸으로 두면 왜 없는지 모른다.
 */
import type { FunStats, MatchDetail, MatchDetailPlayer, MatchDetailTeam, RecentMatch } from './data/types';
import { dateTimeKo, kilo, mmss, pct } from './fmt';
import { laneIdx, laneKo } from './lanes';
import { laneBand, laneCls } from './member';
import { hourRows, type HourRow } from './member-rest';
import type { MetricMetaMap } from './metrics';
import { wrClass } from './tier';

export type ChampKo = Record<string, string> | null | undefined;
/** 챔피언 한글 이름 — 사전에 없으면 id 그대로(숨기면 데이터 문제를 못 본다) */
export const champName = (ko: ChampKo, id: string | null | undefined): string => (id ? ko?.[id] ?? id : '');

// ── 최근 경기 목록 ────────────────────────────────────────────────────

/** 한 번에 그리는 경기 수 — 판이 쌓여도 첫 화면 DOM 이 선형으로 늘지 않게 */
export const MATCH_PAGE = 50;

export interface MatchPlayerCell {
  name: string;
  champ: string;
  champKo: string;
  lane: string;
  laneKo: string;
  /** 라인 띠 이름 'top'·'jg'·… (모르는 라인은 '') */
  band: string;
  /** 툴팁 한 줄 — `탑 · 이름 · 챔피언` */
  tip: string;
}
export interface MatchRow {
  slug: string;
  ts: number;
  /** "9. 17. 오후 08:31" */
  time: string;
  /** 상세 파일이 있는가(`d: 1`) */
  hasDetail: boolean;
  /** 이긴 팀 5명(라인 순). 승패를 모르면 첫 팀 */
  win: MatchPlayerCell[];
  loss: MatchPlayerCell[];
}

function playerCell(p: RecentMatch['teams'][number]['players'][number], ko: ChampKo): MatchPlayerCell {
  const name = String(p.name ?? '');
  const champ = String(p.champ ?? '');
  const ck = champName(ko, champ);
  const lk = laneKo(p.lane);
  return {
    name, champ, champKo: ck, lane: String(p.lane ?? ''), laneKo: lk, band: laneBand(p.lane),
    tip: [lk, name, ck].filter(Boolean).join(' · '),
  };
}

/** 라인 순(탑→서폿)으로 정렬한 새 배열. 모르는 라인은 뒤로 */
export function byLane<T extends { lane: string }>(players: readonly T[]): T[] {
  return players.slice().sort((a, b) => laneIdx(a.lane) - laneIdx(b.lane));
}

/**
 * 최근 경기 → 한 경기 한 행, 시각 내림차순. 팀은 이긴 쪽이 먼저(`win` 이 둘 다 같으면 실린 순서).
 * 슬러그가 없는 항목은 건너뛴다(상세 주소를 만들 수 없다).
 */
export function matchRows(recent: readonly RecentMatch[] | null | undefined, ko?: ChampKo): MatchRow[] {
  const out: MatchRow[] = [];
  for (const m of recent ?? []) {
    if (!m || !m.match_id) continue;
    const teams = (m.teams ?? []).slice();
    const wi = teams.findIndex((t) => !!t.win);
    const a = wi > 0 ? teams[wi]! : teams[0];
    const b = wi > 0 ? teams[0]! : teams[1];
    out.push({
      slug: String(m.match_id),
      ts: Number(m.ts) || 0,
      time: dateTimeKo(m.ts),
      hasDetail: !!m.d,
      win: byLane(a?.players ?? []).map((p) => playerCell(p, ko)),
      loss: byLane(b?.players ?? []).map((p) => playerCell(p, ko)),
    });
  }
  out.sort((x, y) => y.ts - x.ts);
  return out;
}

// ── 스코어보드 ────────────────────────────────────────────────────────

/** 소환사 주문·룬 계열 id → 이름. 아이콘 경로가 버전마다 달라 글자로만 쓴다(옛 파일과 같다). */
export const SPELL_KO: Readonly<Record<number, string>> = {
  1: '정화', 3: '탈진', 4: '점멸', 6: '유체화', 7: '회복', 11: '강타', 12: '순간이동',
  13: '총명', 14: '점화', 21: '방어막', 32: '표식',
};
export const PERK_KO: Readonly<Record<number, string>> = { 8000: '정밀', 8100: '지배', 8200: '마법', 8300: '영감', 8400: '결의' };

const ITEM_SLOTS = 6;

export interface ScoreRow {
  /** 행 키 — `팀번호-pid` */
  key: string;
  pid: number;
  name: string;
  champ: string;
  champKo: string;
  lane: string;
  laneKo: string;
  /** DataTable 문법의 라인 띠 클래스('lane-top') */
  laneCls: string;
  k: number; d: number; a: number;
  /** "9/4/14" */
  kdaText: string;
  kda: number;
  cs: number; gold: number; dmg: number; dmgTaken: number; dmgTurret: number; vision: number;
  /** 아이템 6칸 — 빈 칸은 0 */
  items: number[];
  /** 장신구(7번째). 없으면 null */
  trinket: number | null;
  spells: string;
  perks: string;
  /** 원본 — 펼침 패널(타임라인·빌드·세부 기록)이 읽는다 */
  raw: MatchDetailPlayer;
}

const n0 = (v: unknown): number => Number(v) || 0;

/** 팀 한쪽의 스코어보드 행 — 라인 순. 아이템은 6칸으로 맞추고 7번째는 장신구로 뗀다. */
export function scoreboardRows(team: Pick<MatchDetailTeam, 'team_id' | 'players'> | null | undefined, ko?: ChampKo): ScoreRow[] {
  if (!team) return [];
  return byLane(team.players ?? []).map((p) => {
    const items = (p.items ?? []).map(n0);
    const slots = items.slice(0, ITEM_SLOTS);
    while (slots.length < ITEM_SLOTS) slots.push(0);
    const trinket = items.length > ITEM_SLOTS ? items[ITEM_SLOTS]! : null;
    return {
      key: `${team.team_id}-${p.pid}`,
      pid: n0(p.pid), name: String(p.name ?? ''), champ: String(p.champ ?? ''), champKo: champName(ko, p.champ),
      lane: String(p.lane ?? ''), laneKo: laneKo(p.lane), laneCls: laneCls(p.lane),
      k: n0(p.k), d: n0(p.d), a: n0(p.a), kdaText: `${n0(p.k)}/${n0(p.d)}/${n0(p.a)}`, kda: Number(p.kda) || 0,
      cs: n0(p.cs), gold: n0(p.gold), dmg: n0(p.dmg), dmgTaken: n0(p.dmg_taken), dmgTurret: n0(p.dmg_turret), vision: n0(p.vision),
      items: slots, trinket: trinket || null,
      spells: (p.spells ?? []).filter(Boolean).map((x) => SPELL_KO[x] ?? `주문 ${x}`).join(' · '),
      perks: (p.perks ?? []).filter(Boolean).map((x) => PERK_KO[x] ?? `룬 ${x}`).join(' · '),
      raw: p,
    };
  });
}

/** 수식 줄 — 스코어보드 행 선택. `=KDA(9+14)/4 = 5.75` */
export function fxKda(r: Pick<ScoreRow, 'k' | 'd' | 'a' | 'kda'>): string {
  return `=KDA(${r.k}+${r.a})/${r.d} = ${r.kda}`;
}

/** 팀 표기 — 팀 0(team_id 100)은 블루, 그 밖은 레드 */
export function teamLabel(team: Pick<MatchDetailTeam, 'team_id'>, idx: number): string {
  return team.team_id === 100 || (team.team_id !== 200 && idx === 0) ? '블루팀' : '레드팀';
}

export interface TeamTotalRow {
  key: string;
  label: string;
  win: boolean;
  res: string;
  kills: number; deaths: number; assists: number; gold: number;
  towers: number | null; dragons: number | null; barons: number | null; heralds: number | null; grubs: number | null;
  bans: string[];
}

/** 팀 합계 행 둘. 오브젝트는 `objectivesAvailable` 일 때만 값(아니면 null — 열 자체를 뺀다). */
export function teamTotals(teams: readonly MatchDetailTeam[] | null | undefined, objectivesAvailable: boolean, banAvailable: boolean): TeamTotalRow[] {
  return (teams ?? []).map((t, i) => {
    const o = t.objectives;
    const obj = (k: keyof MatchDetailTeam['objectives']) => (objectivesAvailable ? n0(o?.[k]) : null);
    return {
      key: String(t.team_id ?? i), label: teamLabel(t, i), win: !!t.win, res: t.win ? '승' : '패',
      kills: n0(t.kills), deaths: n0(t.deaths), assists: n0(t.assists), gold: n0(t.gold),
      towers: obj('towers'), dragons: obj('dragons'), barons: obj('barons'), heralds: obj('heralds'), grubs: obj('grubs'),
      bans: banAvailable ? (t.bans ?? []).map(String).filter(Boolean) : [],
    };
  });
}

const PATCH = /^[A-Za-z0-9._-]+$/;
/** ddragon 아이템 이미지 URL. 패치·id 가 URL 조각 모양이 아니면 ''(이미지를 생략한다 — ChampImg 와 같은 규칙). */
export function itemImgUrl(patch: string | null | undefined, id: number | null | undefined): string {
  if (!id || !Number.isInteger(id) || id <= 0 || typeof patch !== 'string' || !PATCH.test(patch)) return '';
  return `https://ddragon.leagueoflegends.com/cdn/${patch}/img/item/${id}.png`;
}

// ── 세부 기록(extra) ──────────────────────────────────────────────────

type ExKind = 0 | 1 | 2;   // 0 숫자 · 1 천 단위 축약 · 2 초→m:ss
const EX_LABEL: readonly [string, string, ExKind][] = [
  ['solo_kills', '솔로킬', 0], ['spree', '최다 연속킬', 0], ['first_blood', '퍼블', 0],
  ['plates', '포탑 방패', 0], ['turrets', '포탑 관여', 0],
  ['dragons', '드래곤', 0], ['barons', '바론', 0], ['heralds', '전령', 0], ['steals', '스틸', 0],
  ['dmg_physical', '물리 피해', 1], ['dmg_magic', '마법 피해', 1], ['dmg_true', '고정 피해', 1],
  ['heal_shield', '힐 · 실드', 1], ['gold_spent', '사용 골드', 1], ['bounty', '현상금 획득', 1],
  ['wards', '와드 설치', 0], ['control_wards', '제어 와드', 0], ['ward_kills', '와드 제거', 0],
  ['skillshots_hit', '스킬샷 명중', 0], ['skillshots_dodged', '스킬샷 회피', 0],
  ['immobilizations', '적 행동불능', 0],
  ['time_dead', '죽어 있던 시간', 2], ['longest_living', '최장 생존', 2],
];

export interface ExtraRow { key: string; label: string; text: string }

/**
 * 값이 0 보다 큰 항목만, 정해진 순서로. 1000 이상은 K, 초는 m:ss.
 * 이름은 지표 레지스트리(metric_meta)에 같은 키가 있으면 그 label — 표 머리와 같은 이름이어야 한다.
 * 레지스트리에 없는 키(연속킬·사용 골드 등)만 여기 적은 이름을 쓴다.
 */
export function extraRows(extra: Record<string, number | boolean> | null | undefined, meta?: MetricMetaMap | null): ExtraRow[] {
  const out: ExtraRow[] = [];
  for (const [key, fallback, kind] of EX_LABEL) {
    const v = Number(extra?.[key]) || 0;
    if (v <= 0) continue;
    const text = kind === 2 ? mmss(v) : kind === 1 && v >= 1000 ? kilo(v) : String(v);
    out.push({ key, label: meta?.[key]?.label || fallback, text });
  }
  return out;
}

// ── 골드 추이 ─────────────────────────────────────────────────────────

export interface GoldSeries {
  minutes: number[];
  a: number[];
  b: number[];
  diff: number[];
  /** |diff| 최대 */
  peak: number;
  /** 마지막 diff(블루 − 레드) */
  last: number;
  /** 팀 골드 최대 */
  maxGold: number;
}

/** 타임라인 → 같은 길이의 세 열. 점이 2개 미만이면 null(차트를 그리지 않는다). */
export function goldSeries(tl: Partial<MatchDetail['timeline']> | null | undefined): GoldSeries | null {
  const minutes = (tl?.minutes ?? []).map(n0);
  const n = minutes.length;
  if (n < 2) return null;
  const fill = (xs: readonly number[] | undefined) => Array.from({ length: n }, (_, i) => n0(xs?.[i]));
  const a = fill(tl?.a_gold), b = fill(tl?.b_gold);
  const diff = tl?.gold_diff && tl.gold_diff.length ? fill(tl.gold_diff) : a.map((v, i) => v - b[i]!);
  return {
    minutes, a, b, diff,
    peak: Math.max(...diff.map(Math.abs)),
    last: diff[n - 1]!,
    maxGold: Math.max(...a, ...b),
  };
}

/** 골드 차이 눈금 — 1000 단위로 올림해 사람이 읽는 수로(옛 규칙) */
export function goldStep(peak: number): number {
  return peak <= 2000 ? 500 : peak <= 6000 ? 1000 : peak <= 15000 ? 2500 : 5000;
}

/** 눈금 간격 — 선이 maxTicks 개를 넘지 않게 500·1K·2.5K·5K·10K… 중 첫 것(120px 판에 14줄이 겹쳤다) */
export function niceStep(max: number, maxTicks = 4): number {
  for (let mag = 500; ; mag *= 10) for (const n of [1, 2, 5]) if (max / (n * mag) <= maxTicks) return n * mag;
}

/** 축 상한 — 눈금 배수로 올림. 0 이면 눈금 하나 */
export function axisTop(v: number, step: number): number {
  return Math.max(step, Math.ceil(v / step) * step);
}

/** 골드 축 라벨 "12K"·"+2.5K"·"−2.5K"·"0" */
export function goldTick(v: number, signed = false): string {
  if (v === 0) return '0';
  const k = Math.abs(v) / 1000;
  const s = (Number.isInteger(k) ? String(k) : k.toFixed(1)) + 'K';
  return signed ? (v > 0 ? '+' : '−') + s : s;
}

/** "최종 블루 +1,234G · 최대 격차 5,678G" */
export function goldSummary(s: Pick<GoldSeries, 'last' | 'peak'>): string {
  const side = s.last >= 0 ? '블루' : '레드';
  return `최종 ${side} +${Math.abs(s.last).toLocaleString('ko-KR')}G · 최대 격차 ${s.peak.toLocaleString('ko-KR')}G`;
}

// ── 킬 지도 ───────────────────────────────────────────────────────────

export interface KillDot {
  i: number;
  m: number;
  /** 0~1, 왼쪽 아래가 블루 진영 */
  x: number;
  y: number;
  /** 잡은 팀 — 'win'·'loss'·'exec'(처형) */
  cls: 'win' | 'loss' | 'exec';
  killer: string;
  victim: string;
  /** "12분 · 잡은 이 → 잡힌 이" */
  label: string;
}

const EXEC = '처형(포탑 · 미니언)';

/** 킬 좌표 → 점. 색은 **잡은 팀**의 결과(승·패), 잡은 이가 없으면 처형. */
export function killDots(
  kills: readonly MatchDetail['kills'][number][] | null | undefined,
  teams: readonly Pick<MatchDetailTeam, 'win' | 'players'>[] | null | undefined,
): KillDot[] {
  const who = new Map<number, { name: string; win: boolean }>();
  for (const t of teams ?? []) for (const p of t.players ?? []) who.set(n0(p.pid), { name: String(p.name ?? ''), win: !!t.win });
  return (kills ?? []).map((k, i) => {
    const kk = k.a ? who.get(n0(k.a)) : undefined;
    const vv = who.get(n0(k.v));
    const killer = kk?.name ?? (k.a ? '?' : EXEC);
    const victim = vv?.name ?? '?';
    const m = n0(k.m);
    return {
      i, m,
      x: Math.min(1, Math.max(0, Number(k.x) || 0)),
      y: Math.min(1, Math.max(0, Number(k.y) || 0)),
      cls: !k.a || !kk ? 'exec' : kk.win ? 'win' : 'loss',
      killer, victim,
      label: `${m}분 · ${killer} → ${victim}`,
    };
  });
}

// ── 빌드 오더 · K/D/A 타임라인 ─────────────────────────────────────────

export interface BuildRow { i: number; item: number; minute: number; sold: boolean }

/**
 * 구매 순서(분 오름차순, 같은 분은 실린 순서). `sold` 는 발행물에 실리지만 types.ts 계약에는
 * 아직 없어 선택 키로 읽는다 — 없으면 false. 아이템 id 가 0 인 항목은 뺀다.
 */
export function buildRows(build: readonly { item: number; minute: number }[] | null | undefined): BuildRow[] {
  return (build ?? [])
    .map((b, i) => ({ i, item: n0(b.item), minute: n0(b.minute), sold: !!(b as { sold?: unknown }).sold }))
    .filter((b) => b.item > 0)
    .sort((x, y) => x.minute - y.minute || x.i - y.i);
}

export type KdaKind = 'K' | 'D' | 'A';
export interface KdaMark {
  i: number;
  s: number;
  kind: KdaKind;
  /** 0~1 — 경기 길이 대비 위치 */
  t: number;
  /** 같은 구간에 겹친 순번(0부터) — 차트가 살짝 흔들어 놓는다 */
  stack: number;
  /** "12분 킬 · 챔피언" */
  label: string;
}
export const KDA_KO: Readonly<Record<KdaKind, string>> = { K: '킬', D: '데스', A: '어시' };

/** 사건 → 표식. 잡은 챔피언이 없는 데스는 처형으로 적는다(빈칸이면 왜 없는지 모른다). */
export function kdaMarks(
  events: readonly { s: number; t: string; vs?: string }[] | null | undefined,
  duration: number,
  ko?: ChampKo,
): KdaMark[] {
  const dur = Math.max(1, n0(duration));
  const seen = new Map<string, number>();
  const out: KdaMark[] = [];
  for (const [i, e] of (events ?? []).entries()) {
    if (!e || e.s == null) continue;
    const kind: KdaKind = e.t === 'K' || e.t === 'D' ? e.t : 'A';
    const s = n0(e.s);
    const key = `${kind}|${Math.round(s / 8)}`;
    const stack = seen.get(key) ?? 0;
    seen.set(key, stack + 1);
    const who = e.vs ? champName(ko, e.vs) : kind === 'D' ? EXEC : '';
    out.push({ i, s, kind, t: Math.min(1, Math.max(0, s / dur)), stack, label: `${Math.floor(s / 60)}분 ${KDA_KO[kind]}${who ? ' · ' + who : ''}` });
  }
  return out;
}

/** 표식 수 — 범례·aria 문장 */
export function kdaCounts(marks: readonly Pick<KdaMark, 'kind'>[]): Record<KdaKind, number> {
  const c: Record<KdaKind, number> = { K: 0, D: 0, A: 0 };
  for (const m of marks) c[m.kind]++;
  return c;
}

// ── 경향 (진영 · 시간대 · 경기 길이) ────────────────────────────────────

export interface SideTeamRow { key: string; side: string; games: number; wins: number; losses: number; winrate: number | null }
export interface SidePlayerRow {
  name: string;
  blueG: number; blueW: number; blueWr: number | null;
  redG: number; redW: number; redWr: number | null;
  /** 블루 − 레드 승률(양쪽 다 출전했을 때만) */
  gap: number | null;
  absGap: number | null;
}
export interface DurationRow {
  name: string; games: number;
  shortG: number; shortWr: number | null;
  midG: number; midWr: number | null;
  longG: number; longWr: number | null;
}
export interface TrendRows {
  sides: SideTeamRow[];
  players: SidePlayerRow[];
  hours: HourRow[];
  duration: DurationRow[];
}

const SIDE_KO: Readonly<Record<string, string>> = { BLUE: '블루', RED: '레드' };
const ratio = (w: number, n: number): number | null => (n > 0 ? w / n : null);

/**
 * 경향 표 넷. 진영별 승률은 payload 값이 아니라 승/판으로 다시 낸다(판 0 이면 null).
 * 멤버별 진영은 양쪽 다 출전한 사람만(비교가 성립하지 않으면 행이 없다), 차이 절댓값 내림차순.
 * 시간대는 판수만(hourRows — 승률은 구조적으로 50% 라 싣지 않는다). 경기 길이는 총 판수 내림차순.
 */
export function trendRows(fun: Partial<FunStats> | null | undefined): TrendRows {
  const sides = (fun?.sides?.team ?? []).map((t) => {
    const games = n0(t.games), wins = n0(t.wins);
    return { key: String(t.side), side: SIDE_KO[String(t.side)] ?? String(t.side), games, wins, losses: games - wins, winrate: ratio(wins, games) };
  });
  const players: SidePlayerRow[] = [];
  for (const p of fun?.sides?.players ?? []) {
    const blueG = n0(p.blue_g), blueW = n0(p.blue_w), redG = n0(p.red_g), redW = n0(p.red_w);
    const blueWr = ratio(blueW, blueG), redWr = ratio(redW, redG);
    if (blueWr == null || redWr == null) continue;
    const gap = blueWr - redWr;
    players.push({ name: String(p.discord_name ?? ''), blueG, blueW, blueWr, redG, redW, redWr, gap, absGap: Math.abs(gap) });
  }
  players.sort((x, y) => (y.absGap ?? 0) - (x.absGap ?? 0) || x.name.localeCompare(y.name, 'ko'));
  const duration = (fun?.by_duration ?? []).map((r) => {
    const shortG = n0(r.short_g), midG = n0(r.mid_g), longG = n0(r.long_g);
    return {
      name: String(r.discord_name ?? ''), games: shortG + midG + longG,
      shortG, shortWr: shortG ? Number(r.short_wr) || 0 : null,
      midG, midWr: midG ? Number(r.mid_wr) || 0 : null,
      longG, longWr: longG ? Number(r.long_wr) || 0 : null,
    };
  });
  duration.sort((x, y) => y.games - x.games || x.name.localeCompare(y.name, 'ko'));
  return { sides, players, hours: hourRows(fun?.by_hour), duration };
}

/** "75% (8)" — 승률과 판수를 한 셀에. 판 0 이면 '-' */
export function wrWithGames(wr: number | null | undefined, games: number): string {
  return games > 0 && wr != null ? `${pct(wr)} (${games})` : '-';
}

/** 승률 셀 클래스 — 문턱 이상이면 win/loss 채움, 미만이면 옅은 글자(wr-dim), 판 0 이면 '' */
export function wrCellCls(wr: number | null | undefined, games: number, minGames: number): string {
  if (wr == null || games <= 0) return '';
  const c = wrClass(wr, games, minGames);
  return c === 'wr-h' ? 'win' : c === 'wr-l' ? 'loss' : c === 'wr-dim' ? 'wr-dim' : '';
}

/** 진영 차이 "+33%p"(블루 우세) · "−20%p"(레드 우세) */
export function gapText(gap: number | null | undefined): string {
  if (gap == null) return '-';
  const p = Math.round(gap * 100);
  return (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p) + '%p';
}
