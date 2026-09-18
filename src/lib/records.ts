/**
 * 기록 화면의 파생값 — 명예의 전당·경기 기록·역전·데스·히트맵 좌표. 전부 순수 함수다.
 *
 * 전역 store 를 읽지 않는다. 컴포넌트가 payload 조각을 넘기고, 테스트는 작은 객체를 넘긴다.
 * 옛 renderRecords·serverRecordsHTML·renderFun·heatmap(legacy/index.html)의 계산 규칙만 옮겼고
 * 문구 조립은 여기서, 마크업은 컴포넌트에서 한다.
 *
 * 기록 이름표(RECORD_DEFS)는 옛 화면의 한국어 이름을 그대로 옮겼다 — 서버가 새 기록을 보내면
 * 여기 한 줄만 늘린다. 없는 키는 행이 없고, 사전에 없는 키는 그리지 않는다(이름표 없는 기록을
 * 키 그대로 보이면 'most_x' 가 화면에 찍힌다).
 */
import type { DeathsFile, FunStats, LaneId, RecordEntry, RecordsMap, ServerRecords } from './data/types';
import { dateKo, kda, mmss, num } from './fmt';
import { isLaneId } from './lanes';

// ── 명예의 전당 ──────────────────────────────────────────────────────

/** 기록 키 → 이름표. 순서가 곧 표 순서다(옛 DEFS + 최장 연승). */
export const RECORD_DEFS: readonly (readonly [key: string, label: string])[] = [
  ['best_kda', '최고 KDA'], ['most_dmg', '최다 딜'],
  ['most_cs', '최다 CS'], ['most_cs15', '최다 CS@15'],
  ['most_gold', '최다 골드'], ['best_lane_cs_adv', '최대 라인전 CS 격차'],
  ['most_plates', '최다 포탑 방패'], ['most_solo_kills', '최다 솔로킬'],
  ['most_heal_shield', '최다 힐·실드'], ['most_vision', '최고 시야 점수'],
  ['most_jungle_cs10', '최다 정글 CS@10'], ['most_steals', '스틸'],
  ['most_dmg_taken', '최다 탱킹'], ['most_bounty', '최다 현상금 수급'],
  ['longest_living', '최장 생존'], ['longest_streak', '최장 연승'],
];

export interface HallRow {
  /** 행 키 — 기록 키 */
  key: string;
  label: string;
  name: string;
  /** 화면 글자 — 숫자는 천단위, 문자열("+144"·"30:13")은 그대로, 연승은 'n연승' */
  value: string;
  /** 정렬용 — 문자열 기록은 null(정렬에서 맨 아래) */
  valueNum: number | null;
  /** 챔피언 id(초상) — 없으면 '' */
  champ: string;
  champKo: string;
  /** '14/1/14' — K/D/A 가 전부 없으면 '' */
  kdaText: string;
  /** null 이면 결과 없음(연승 기록) */
  win: boolean | null;
  /** 초 — 없으면 null */
  dur: number | null;
  /** ms epoch — 없으면 null */
  ts: number | null;
}

function isEntry(v: unknown): v is RecordEntry {
  return !!v && typeof v === 'object' && !Array.isArray(v) && typeof (v as RecordEntry).name === 'string' && (v as RecordEntry).name !== '';
}

/**
 * records 사전 → 기록 표 행(RECORD_DEFS 순서). 값이 없거나 이름이 빈 기록은 행이 없다.
 * `min_games`(숫자)·`pentas`(목록)는 기록이 아니라 건너뛴다.
 */
export function hallRows(records: RecordsMap | null | undefined, champKo: (id: string) => string): HallRow[] {
  const out: HallRow[] = [];
  for (const [key, label] of RECORD_DEFS) {
    const e = records?.[key];
    if (!isEntry(e)) continue;
    const isNum = typeof e.value === 'number';
    const value = key === 'longest_streak' ? `${e.value}연승` : num(e.value);
    const champ = typeof e.champ === 'string' ? e.champ : '';
    const hasKda = e.k != null && (Boolean(e.k) || Boolean(e.d) || Boolean(e.a));
    out.push({
      key, label, name: e.name,
      value, valueNum: isNum ? (e.value as number) : null,
      champ, champKo: champ ? champKo(champ) : '',
      kdaText: hasKda ? kda(e.k, e.d, e.a) : '',
      win: typeof e.win === 'boolean' ? e.win : null,
      dur: e.dur ? Number(e.dur) : null,
      ts: e.ts ? Number(e.ts) : null,
    });
  }
  return out;
}

/** 수식 줄 — 기록 하나의 근거: `=최고 KDA 28 · 외 걸 · 아리 14/1/14 · 승 · 30:04 · 9. 3.` 있는 조각만 잇는다 */
export function hallFx(r: HallRow): string {
  const parts = [`=${r.label} ${r.value}`, r.name];
  const champ = [r.champKo, r.kdaText].filter(Boolean).join(' ');
  if (champ) parts.push(champ);
  if (r.win != null) parts.push(r.win ? '승' : '패');
  if (r.dur) parts.push(mmss(r.dur));
  if (r.ts) parts.push(dateKo(r.ts));
  return parts.join(' · ');
}

export interface PentaRow { key: string; name: string; champ: string; champKo: string }

/** records.pentas 목록 → 행. 목록이 아니면 빈 배열. 키는 순번을 붙인다(같은 사람·같은 챔피언 두 번 가능). */
export function pentaRows(records: RecordsMap | null | undefined, champKo: (id: string) => string): PentaRow[] {
  const list = records?.pentas;
  if (!Array.isArray(list)) return [];
  return list.filter(isEntry).map((e, i) => {
    const champ = typeof e.champ === 'string' ? e.champ : '';
    return { key: `${i}:${e.name}:${champ}`, name: e.name, champ, champKo: champ ? champKo(champ) : '' };
  });
}

// ── 경기 기록 ────────────────────────────────────────────────────────

export interface ServerRow {
  key: 'shortest' | 'longest' | 'most_kills' | 'avg_kills';
  label: string;
  /** 초 — 평균 행은 null */
  dur: number | null;
  /** 'm:ss' — 평균 행은 '' */
  time: string;
  kills: number;
  ts: number | null;
  /** 경기 날짜 '9. 3.' — 평균 행은 '전체 n경기' */
  when: string;
}

/**
 * server_records → 경기 기록 표(최단·최장·최다 킬·경기당 평균 킬). 경기는 날짜·길이로만 특정한다 —
 * 매치 ID 는 익명화 원칙상 여기 없다. avg_kills 가 없으면(옛 발행물) 빈 배열.
 */
export function serverRows(sr: ServerRecords | null | undefined, totalGames: number | null | undefined): ServerRow[] {
  if (!sr || !sr.avg_kills) return [];
  const game = (key: ServerRow['key'], label: string, g: ServerRecords['shortest'] | undefined): ServerRow | null => {
    if (!g) return null;
    const dur = Number(g.dur) || 0;
    const ts = Number(g.ts) || null;
    return { key, label, dur, time: mmss(dur), kills: Number(g.kills) || 0, ts, when: ts ? dateKo(ts) : '' };
  };
  const rows = [
    game('shortest', '최단 경기', sr.shortest),
    game('longest', '최장 경기', sr.longest),
    game('most_kills', '최다 킬 경기', sr.most_kills),
  ].filter((r): r is ServerRow => r !== null);
  const total = Number(totalGames) || 0;
  rows.push({
    key: 'avg_kills', label: '경기당 평균 킬', dur: null, time: '', kills: Number(sr.avg_kills) || 0, ts: null,
    when: total ? `전체 ${total}경기` : '',
  });
  return rows;
}

// ── MVP ──────────────────────────────────────────────────────────────

/** MVP 표 합계와 문턱 미달 제외분을 합쳐 총 경기 수와 맞추는 문장. 제외가 없으면 ''. */
export function mvpNote(
  mvp: readonly { mvp: number }[] | null | undefined,
  excluded: { awards: number; players: number } | null | undefined,
  minGames: number,
): string {
  const awards = Number(excluded?.awards) || 0;
  if (awards <= 0) return '';
  const sum = (mvp ?? []).reduce((t, r) => t + (Number(r.mvp) || 0), 0);
  return `판수 미달 ${Number(excluded?.players) || 0}명 제외(${awards}회) · 표 합계 ${sum}회 + ${awards}회 = 총 ${sum + awards}경기 · 문턱 ${minGames}판`;
}

// ── 역전 · 데스 ──────────────────────────────────────────────────────

export interface ComebackRow {
  name: string;
  behind_g: number;
  comeback: number;
  /** 열세 판이 없으면 null — '역전 0%' 는 못 한 게 아니라 기회가 없던 것이다 */
  comeback_rate: number | null;
  ahead_g: number;
  thrown: number;
  /** 우세 판이 없으면 null */
  throw_rate: number | null;
}

/** fun.comeback → 행. 열세·우세 판이 둘 다 0 이면 행이 없다(적을 게 없는 줄). */
export function comebackRows(rows: FunStats['comeback'] | null | undefined): ComebackRow[] {
  const out: ComebackRow[] = [];
  for (const r of rows ?? []) {
    const behind = Number(r.behind_g) || 0, ahead = Number(r.ahead_g) || 0;
    if (!behind && !ahead) continue;
    out.push({
      name: r.discord_name, behind_g: behind, comeback: Number(r.comeback) || 0,
      comeback_rate: behind ? Number(r.comeback_rate) || 0 : null,
      ahead_g: ahead, thrown: Number(r.thrown) || 0,
      throw_rate: ahead ? Number(r.throw_rate) || 0 : null,
    });
  }
  return out;
}

export interface DeathRow {
  name: string;
  games: number;
  /** 첫 데스 평균 시각(분) — 없으면 null */
  first_death_min: number | null;
  /** 판이 없으면 null */
  fb_given: number | null;
  bounty_given: number | null;
}

/** fun.deaths → 행. 분모는 games 다(옛 화면이 deaths 를 게이트로 써서 전부 '-' 가 된 적이 있다). */
export function deathRows(rows: FunStats['deaths'] | null | undefined): DeathRow[] {
  return (rows ?? []).map((r) => {
    const games = Number(r.games) || 0;
    return {
      name: r.discord_name, games,
      first_death_min: r.first_death_min == null ? null : Number(r.first_death_min),
      fb_given: games ? Number(r.fb_given) || 0 : null,
      bounty_given: r.bounty_given == null ? null : Number(r.bounty_given),
    };
  });
}

// ── 용 ───────────────────────────────────────────────────────────────

const DRAGON_KO: Readonly<Record<string, string>> = {
  FIRE_DRAGON: '화염', WATER_DRAGON: '바다', EARTH_DRAGON: '대지', AIR_DRAGON: '바람',
  HEXTECH_DRAGON: '마공학', CHEMTECH_DRAGON: '화학공학', ELDER_DRAGON: '장로',
};

/** 용 종류 표기. 모르는 키는 그대로(숨기면 데이터 문제를 못 본다). */
export function dragonKo(id: string | null | undefined): string {
  return (id && DRAGON_KO[id]) || id || '?';
}

// ── 데스 히트맵 ──────────────────────────────────────────────────────

/** 소환사의 협곡 좌표계 한 변(0~14870). y 축은 위로 자란다(SVG 는 아래로) → 뒤집어 그린다 */
export const MAP_SIZE = 14870;

export interface HeatPoint { x: number; y: number; m: number; lane: LaneId | string }

/**
 * 표본 점 → SVG 좌표(한 변 `size`). lane 이 있으면 그 라인만. 좌표는 소수 첫째 자리까지.
 * 맵 밖 좌표(음수·한 변 초과)는 가장자리로 자른다 — 점 하나가 SVG 밖으로 나가면 스크롤이 생긴다.
 */
export function heatPoints(points: readonly DeathsFile['points'][number][] | null | undefined, lane: string, size: number): HeatPoint[] {
  const out: HeatPoint[] = [];
  const f = (v: number) => Math.round(Math.max(0, Math.min(size, v)) * 10) / 10;
  for (const p of points ?? []) {
    if (lane && p.lane !== lane) continue;
    out.push({
      x: f((Number(p.x) / MAP_SIZE) * size),
      y: f(size - (Number(p.y) / MAP_SIZE) * size),
      m: Number(p.m) || 0,
      lane: isLaneId(p.lane) ? p.lane : String(p.lane ?? ''),
    });
  }
  return out;
}

/**
 * 점 크기·불투명도 — 점이 많아질수록 작고 옅게. 1,833개를 r 2.6·불투명도 .5 로 찍으면 칠하는 넓이가
 * 판의 42% 라 분포가 아니라 얼룩이 된다(옛 실측). 판이 쌓일수록 더 나빠지므로 개수로 단계를 나눈다.
 */
export function heatDot(n: number): { r: number; op: number } {
  if (n > 1200) return { r: 1.8, op: 0.34 };
  if (n > 600) return { r: 2.2, op: 0.42 };
  return { r: 2.6, op: 0.5 };
}

/** 캡션 — 표본이 무엇인지 사실대로: '최근 42경기 · 데스 2,000건' + 상한이면 ' · 표본 상한(전체 2,765건 중)' */
export function heatCaption(d: Pick<DeathsFile, 'games' | 'total' | 'capped'> & { points: readonly unknown[] }): string {
  const n = d.points.length.toLocaleString('ko-KR');
  let s = d.games ? `최근 ${d.games}경기 · 데스 ${n}건` : `데스 ${n}건`;
  if (d.capped) s += ` · 표본 상한(전체 ${(Number(d.total) || 0).toLocaleString('ko-KR')}건 중)`;
  return s;
}
