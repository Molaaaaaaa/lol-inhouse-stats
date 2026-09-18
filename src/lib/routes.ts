/**
 * 화면(섹션) → 지연 import. 라우트 단위로 청크가 갈린다(`script-src 'self'` 아래서 동적 import 는 허용).
 * 옛 사이트의 "탭을 켤 때 그린다"(VIEW_RENDER) 와 같은 뜻이다.
 */
import type { Component } from 'svelte';
import type { Section } from './router.svelte';

export const VIEWS: Record<Section, () => Promise<{ default: Component<{ sub: string; params: Record<string, string> }> }>> = {
  home: () => import('../routes/Home.svelte'),
  member: () => import('../routes/Member.svelte'),
  rank: () => import('../routes/Rank.svelte'),
  records: () => import('../routes/Records.svelte'),
  synergy: () => import('../routes/Synergy.svelte'),
  champions: () => import('../routes/Champions.svelte'),
  matches: () => import('../routes/Matches.svelte'),
  math: () => import('../routes/Math.svelte'),
};

/** 문서 제목·안내 음성에 쓰는 화면 이름 (명사) */
export const VIEW_TITLE: Record<Section, string> = {
  home: '멤버', member: '멤버', rank: '순위', records: '기록', synergy: '시너지',
  champions: '챔피언', matches: '경기', math: '계산식',
};
