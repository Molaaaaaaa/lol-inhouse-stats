import { describe, expect, it } from 'vitest';
import { parseHash, memberHref, compareHref, metricHref, matchHref } from '../src/lib/router.svelte';

describe('parseHash', () => {
  it('빈 해시와 #/ 는 홈', () => {
    expect(parseHash('').section).toBe('home');
    expect(parseHash('#/').section).toBe('home');
    expect(parseHash('#/').unknown).toBe(false);
  });
  it('멤버 이름을 디코딩한다 (한글·공백·동명이인 순번)', () => {
    const r = parseHash(memberHref('외 걸'));
    expect(r.section).toBe('member');
    expect(r.params.name).toBe('외 걸');
    expect(parseHash('#/m/%EC%99%B8%20%EA%B1%B8~2').params.name).toBe('외 걸~2');
  });
  it('비교 경로', () => {
    const r = parseHash(compareHref('a', 'b'));
    expect(r).toMatchObject({ section: 'member', sub: 'compare', params: { name: 'a', b: 'b' } });
  });
  it('순위: board/metric/play 와 라인 선택', () => {
    expect(parseHash('#/rank')).toMatchObject({ section: 'rank', sub: 'board' });
    expect(parseHash('#/rank/board/TOP')).toMatchObject({ sub: 'board', params: { lane: 'TOP' } });
    expect(parseHash(metricHref('dpm'))).toMatchObject({ sub: 'metric', params: { key: 'dpm' } });
    expect(parseHash(metricHref('solo_kills_total', 'MIDDLE')).params).toEqual({ key: 'solo_kills_total', lane: 'MIDDLE' });
    expect(parseHash('#/rank/play').sub).toBe('play');
  });
  it('섹션 기본 하위 화면', () => {
    expect(parseHash('#/records').sub).toBe('hall');
    expect(parseHash('#/synergy/heat').sub).toBe('heat');
    expect(parseHash('#/champions').sub).toBe('meta');
    expect(parseHash('#/champions/meta/UTILITY').params.lane).toBe('UTILITY');
    expect(parseHash('#/math').sub).toBe('cp');
  });
  it('경기: 목록·상세·경향', () => {
    expect(parseHash('#/matches')).toMatchObject({ section: 'matches', sub: 'list' });
    expect(parseHash('#/matches/trend').sub).toBe('trend');
    expect(parseHash(matchHref('m1a2b3'))).toMatchObject({ sub: 'detail', params: { slug: 'm1a2b3' } });
  });
  it('모르는 경로는 홈 + unknown', () => {
    const r = parseHash('#/balance');
    expect(r.section).toBe('home');
    expect(r.unknown).toBe(true);
  });
  it('잘못된 퍼센트 인코딩에 죽지 않는다', () => {
    expect(parseHash('#/m/%E0%A4%A').params.name).toBe('%E0%A4%A');
  });
});
