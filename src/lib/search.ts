/**
 * 소환사명 검색 — 부분일치 + 초성일치. 순수 함수라 화면·상태를 모른다.
 *
 * 피드백(2026-09-03): 목록이 너무 많고 난잡해서 내 파트를 못 찾는다. 이름을 치면 맞는 이름이
 * 바로 떠야 하고, 'ㅇㅇㅁ' 처럼 자음만 쳐도 앙앙맹이 나와야 한다. 표 강조나 걸러 보기는
 * 하지 않는다(요청) — 그래서 이 모듈은 후보 목록에서 **고르는 일만** 한다.
 */

/** 검색 후보 — 표시명만 있으면 된다. 나머지 필드는 호출부가 얹어 그대로 돌려받는다. */
export interface Named { name: string }

/** 비교용 정규화: 소문자 + 공백 제거. 질의와 이름 양쪽에 같은 규칙을 걸어야 맞는다. */
export const norm = (s: string | null | undefined): string =>
  String(s ?? '').toLowerCase().replace(/\s+/g, '');

// 한글 음절의 초성 19개 — 유니코드 음절 블록(가=0xAC00)은 초성 하나당 588자(중성 21 × 종성 28)씩 묶인다.
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const SYL_BASE = 0xac00;
const SYL_LAST = 0xd7a3;
const PER_CHO = 588;

/** 초성 문자열 — '앙앙맹' → 'ㅇㅇㅁ'. 한글 음절이 아닌 글자(영문·숫자·자모)는 정규화만 하고 그대로 둔다. */
export function cho(s: string | null | undefined): string {
  return [...norm(s)]
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c < SYL_BASE || c > SYL_LAST) return ch;
      return CHO[Math.floor((c - SYL_BASE) / PER_CHO)] ?? ch;
    })
    .join('');
}

// 자음만 친 질의인가 — 그때만 이름의 초성 문자열과 견준다. 음절이 하나라도 섞이면 부분일치다.
const JAMO_ONLY = /^[ㄱ-ㅎ]+$/;

/**
 * 질의에 맞는 후보 — 앞쪽에서 맞을수록 먼저, 같으면 한글 사전순. 빈 질의는 빈 목록.
 * limit 은 옛 화면의 12 를 기본으로 둔다(펼침 목록이 화면을 덮지 않는 크기).
 */
export function searchHits<T extends Named>(q: string, cands: readonly T[], limit = 12): T[] {
  const k = norm(q);
  if (!k) return [];
  const keyOf = JAMO_ONLY.test(k) ? cho : norm;
  const scored: { c: T; at: number }[] = [];
  for (const c of cands) {
    const at = keyOf(c.name).indexOf(k);
    if (at >= 0) scored.push({ c, at });
  }
  return scored
    .sort((a, b) => a.at - b.at || a.c.name.localeCompare(b.c.name, 'ko'))
    .slice(0, limit)
    .map((x) => x.c);
}
