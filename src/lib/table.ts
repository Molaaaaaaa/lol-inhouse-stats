/**
 * 표 열 스펙·정렬·거르기·막대 — DataTable 이 쓰는 순수 함수. 화면·상태·전역 DATA 를 모른다.
 *
 * 옛 renderTable(legacy/index.html) 의 규칙을 그대로 옮겼다:
 * - 숫자는 숫자로, 그 밖은 한국어 사전순(localeCompare 'ko').
 * - 빈 값(null·undefined·NaN)은 가장 작은 값 — 내림차순 표에서 맨 아래. `nullLast` 열은 방향과
 *   상관없이 항상 맨 아래('맞대결 0판' 이 마진 0 으로 중간에 끼지 않게).
 * - 거르기는 화면에 보이는 글자(fmt 결과) 기준, 숫자 열은 빼고 본다 — '5' 를 치면 5가 든 숫자
 *   셀이 전부 걸리는 것을 막는다. 자음만 치면 초성으로 견준다(소환사명 검색과 같은 규칙).
 */
import { cho, norm } from './search';

export type SortDir = 1 | -1;

/** 열 스펙. `k` 는 행 객체의 키, `h` 는 머리 라벨(지표는 mLabel 로 만든 것만). */
export interface Col<T> {
  k: string;
  h: string;
  /** 숫자 열 — 오른쪽 정렬·tabular-nums. 거르기 대상에서 뺀다 */
  num?: boolean;
  /** 데이터 막대 — 셀 바탕 그라디언트, 열 최대값 기준. 낮을수록 좋은 열은 무시 */
  bar?: boolean;
  /** 챔피언 id → 셀 앞 초상. 영숫자가 아니면 그리지 않는다 */
  img?: (r: T) => string | null | undefined;
  /** 셀 글자. i 는 표시 순서(정렬·거르기 뒤) */
  fmt?: (v: unknown, r: T, i: number) => string;
  /** 셀 클래스 — 'win'·'loss'·'t1'…'t5'·'pend'·'lane-top'… 조건부 서식은 DataTable 이 그린다 */
  cls?: (r: T) => string;
  /** HELP 키 — 있으면 머리에 물음표 */
  hlp?: string;
  /** 폰(≤640px)에서 숨기는 보조 열. 정렬 기준 열이면 숨기지 않는다 */
  lo?: boolean;
  /** 빈 값을 방향과 상관없이 맨 아래로 */
  nullLast?: boolean;
  /** 기본 true */
  sortable?: boolean;
  /** 코드 판(GD10·CSM…) — 지표 설명에 실제로 들어 있을 때만 호출부가 준다 */
  code?: string;
}

/** 긴 표 접기 문턱 — 이보다 많으면 FOLD_SHOW 줄만 보이고 '더 보기' */
export const FOLD_MIN = 16;
export const FOLD_SHOW = 10;
/** 거르기 칸 문턱 — 이보다 많으면 표 위에 검색 칸 */
export const FILTER_MIN = 20;

/** 행 객체에서 열 값. 행 타입을 모르는 자리라 unknown 으로 돌려준다 */
export function cell<T>(r: T, k: string): unknown {
  return (r as Record<string, unknown>)[k];
}

export function isNil(v: unknown): boolean {
  return v == null || (typeof v === 'number' && Number.isNaN(v));
}

/** 오름차순 비교. 빈 값은 가장 작다. 숫자가 하나라도 있으면 숫자로, 아니면 한국어 사전순. */
export function compareValues(x: unknown, y: unknown): number {
  const nx = isNil(x), ny = isNil(y);
  if (nx || ny) return nx && ny ? 0 : nx ? -1 : 1;
  if (typeof x === 'number' || typeof y === 'number') return (Number(x) || 0) - (Number(y) || 0);
  if (typeof x === 'boolean' && typeof y === 'boolean') return Number(x) - Number(y);
  return String(x).localeCompare(String(y), 'ko');
}

/**
 * 정렬한 새 배열. key 가 없으면 복사만. 안정 정렬이라 같은 값은 들어온 순서를 지킨다.
 * nullLast: 빈 값은 dir 과 무관하게 맨 아래.
 */
export function sortRows<T>(rows: readonly T[], key: string | null | undefined, dir: SortDir = -1, nullLast = false): T[] {
  const out = rows.slice();
  if (!key) return out;
  out.sort((a, b) => {
    const x = cell(a, key), y = cell(b, key);
    if (nullLast) {
      const nx = isNil(x), ny = isNil(y);
      if (nx || ny) return nx && ny ? 0 : nx ? 1 : -1;
    }
    return compareValues(x, y) * dir;
  });
  return out;
}

/** 열을 처음 눌렀을 때의 방향 — 낮을수록 좋은 지표만 오름차순 */
export function defaultDir(key: string | null | undefined, lowerBetterKeys: readonly string[] = []): SortDir {
  return key && lowerBetterKeys.includes(key) ? 1 : -1;
}

/** 머리를 눌렀을 때 다음 정렬 — 같은 열이면 방향 반전, 다른 열이면 그 열의 기본 방향 */
export function nextSort(
  cur: { k: string | null; d: SortDir },
  key: string,
  lowerBetterKeys: readonly string[] = [],
): { k: string; d: SortDir } {
  if (cur.k === key) return { k: key, d: cur.d === 1 ? -1 : 1 };
  return { k: key, d: defaultDir(key, lowerBetterKeys) };
}

/** 셀에 보이는 글자 — fmt 가 있으면 그것, 없으면 값 그대로(빈 값은 '') */
export function cellText<T>(c: Col<T>, r: T, i: number): string {
  const v = cell(r, c.k);
  if (c.fmt) return c.fmt(v, r, i);
  return isNil(v) ? '' : String(v);
}

/** 거르기에 쓰는 행 글자 — 숫자 열을 뺀 셀 글자를 이어 붙인 것 */
export function rowText<T>(r: T, cols: readonly Col<T>[], i: number): string {
  let s = '';
  for (const c of cols) if (!c.num) s += cellText(c, r, i) + ' ';
  return s;
}

const JAMO_ONLY = /^[ㄱ-ㅎ]+$/;

/** 질의에 걸린 행만. 빈 질의는 전부(복사). 자음만 친 질의는 초성으로 견준다. */
export function filterRows<T>(rows: readonly T[], q: string, cols: readonly Col<T>[]): T[] {
  const k = norm(q);
  if (!k) return rows.slice();
  const keyOf = JAMO_ONLY.test(k) ? cho : norm;
  return rows.filter((r, i) => keyOf(rowText(r, cols, i)).includes(k));
}

/** 막대 열의 기준값(열 최대). 전부 0 이하면 아주 작은 양수 — 0 나누기를 막는다 */
export function colMax<T>(rows: readonly T[], k: string): number {
  let m = 0;
  for (const r of rows) {
    const v = Number(cell(r, k)) || 0;
    if (v > m) m = v;
  }
  return m > 0 ? m : 0.0001;
}

/**
 * 막대 너비(0~100, 소수 첫째 자리). 셀은 `--bar: N%` 하나만 인라인으로 받고, 그라디언트
 * 자체는 DataTable 의 스타일시트에 한 번만 적는다(색은 토큰 --sel 22%) — 인라인에 색이 없다.
 */
export function barPct(v: unknown, max: number): number {
  const p = ((Number(v) || 0) / max) * 100;
  return Math.round(Math.max(0, Math.min(100, p)) * 10) / 10;
}
