/**
 * 라인 이름 — **단일 출처.** 검사가 `LANE_KO` 정의 수(=1)를 센다.
 *
 * 왜 한 곳인가: 같은 내용의 상수가 둘이었을 때 라인 필터만 BOTTOM 을 다른 말로 불러
 * 필터와 표·툴팁의 표기가 갈렸다(실측). 표기는 `inhouse/terms.py` CANON 을 따른다.
 */
import type { LaneId } from '$lib/data/types';

export const LANE_KO: Readonly<Record<LaneId, string>> = {
  TOP: '탑',
  JUNGLE: '정글',
  MIDDLE: '미드',
  BOTTOM: '원딜',
  UTILITY: '서폿',
};

/** 화면에 늘어놓는 순서 — 탑부터 서폿까지. 정렬·필터·라인 칸 모두 이 순서다. */
export const LANE_SEQ: readonly LaneId[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

/** payload 의 문자열이 라인 키인가 — sanitize 를 거친 값은 string 이라 여기서 좁힌다. */
export function isLaneId(l: unknown): l is LaneId {
  return typeof l === 'string' && Object.prototype.hasOwnProperty.call(LANE_KO, l);
}

/** 라인 표기. 모르는 키는 그대로 보여 주고(숨기면 데이터 문제를 못 본다), 비어 있으면 '?'. */
export function laneKo(l: string | null | undefined): string {
  if (isLaneId(l)) return LANE_KO[l];
  return l || '?';
}

/** 정렬용 순번 — 모르는 라인은 맨 뒤(9). */
export function laneIdx(l: string | null | undefined): number {
  const i = isLaneId(l) ? LANE_SEQ.indexOf(l) : -1;
  return i < 0 ? 9 : i;
}
