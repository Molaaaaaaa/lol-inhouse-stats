/**
 * 최상위 내비게이션 — **단일 출처.** 검사(`scripts/_inhouse_site_check.py`)가 이 목록의 길이(≤6)와
 * 라벨(명사·금지어)을 읽는다. 라벨은 명사구, 이모지 금지.
 */
export interface NavItem {
  id: string;      // 라우트 섹션 id (router.ts 의 section 과 같다)
  href: string;    // hash 경로
  label: string;
}

export const NAV: readonly NavItem[] = [
  { id: 'home', href: '#/', label: '멤버' },
  { id: 'rank', href: '#/rank/board', label: '순위' },
  { id: 'records', href: '#/records/hall', label: '기록' },
  { id: 'synergy', href: '#/synergy/duo', label: '시너지' },
  { id: 'champions', href: '#/champions/meta', label: '챔피언' },
  { id: 'matches', href: '#/matches', label: '경기' },
];
