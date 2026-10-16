import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import GoldChart from '../src/components/charts/GoldChart.svelte';
import KillMap from '../src/components/charts/KillMap.svelte';
import KdaTimeline from '../src/components/charts/KdaTimeline.svelte';
import DmgBars from '../src/components/charts/DmgBars.svelte';
import { killDots } from '../src/lib/matches';
import type { MatchDetail } from '../src/lib/data/types';
import { CHAMP_KO, DETAIL } from './fixtures/match-payload';

const HEX = /#[0-9a-fA-F]{3,8}\b/;
/** SVG 안 모든 속성값에 hex 색이 없는가 — 색은 class → CSS 토큰으로만 */
function noHexAttrs(root: Element): boolean {
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const a of el.getAttributeNames()) if (HEX.test(el.getAttribute(a) ?? '')) return false;
  }
  return true;
}
const pts = (el: Element | null) => (el?.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean);

afterEach(cleanup);

describe('GoldChart', () => {
  it('팀 골드 선 둘(결과 class) · 차이 면적 + 선 · 눈금 · 5분 라벨 · 요약', () => {
    const { container } = render(GoldChart, { timeline: DETAIL.timeline, teams: DETAIL.teams });
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('골드 추이: 최종 블루 +1,500G · 최대 격차 1,500G');
    expect(pts(svg.querySelector('polyline.ta'))).toHaveLength(6);
    expect(pts(svg.querySelector('polyline.tb'))).toHaveLength(6);
    expect(svg.querySelector('polyline.ta')?.classList.contains('win')).toBe(true);
    expect(svg.querySelector('polyline.tb')?.classList.contains('loss')).toBe(true);
    expect(pts(svg.querySelector('polygon.area'))).toHaveLength(8);   // 0선 양 끝 + 6점
    expect(pts(svg.querySelector('polyline.diff'))).toHaveLength(6);
    expect(svg.querySelector('circle.last')?.classList.contains('win')).toBe(true);   // 최종 블루 우세 = 이긴 팀 색
    const labels = [...svg.querySelectorAll('text.tk')].map((t) => t.textContent);
    expect(labels).toContain('0분');
    expect(labels).toContain('5분');
    expect(labels).toContain('0');
    expect(labels).toContain('+1.5K');
    expect(labels).toContain('−1.5K');
    expect(container.querySelector('.foot')?.textContent).toBe('최종 블루 +1,500G · 최대 격차 1,500G');
    expect(container.querySelector('.legend')?.textContent).toContain('블루팀 · 승');
    expect(container.querySelector('.legend')?.textContent).toContain('레드팀 · 패');
  });
  it('그라디언트 id — 두 인스턴스가 다르고, 면적이 자기 id 를 가리킨다', () => {
    const { container } = render(GoldChart, { timeline: DETAIL.timeline, teams: DETAIL.teams });
    const second = render(GoldChart, { timeline: DETAIL.timeline, teams: DETAIL.teams });
    const g1 = container.querySelector('linearGradient')!.id;
    const g2 = second.container.querySelector('linearGradient')!.id;
    expect(g1).toBeTruthy();
    expect(g2).toBeTruthy();
    expect(g1).not.toBe(g2);
    expect(container.querySelector('polygon.area')?.getAttribute('fill')).toBe(`url(#${g1})`);
    expect(second.container.querySelector('polygon.area')?.getAttribute('fill')).toBe(`url(#${g2})`);
  });
  it('SVG 속성에 hex 없음 — stop 도 class 만', () => {
    const { container } = render(GoldChart, { timeline: DETAIL.timeline, teams: DETAIL.teams });
    expect(noHexAttrs(container.querySelector('svg')!)).toBe(true);
    expect(container.innerHTML).not.toMatch(/(fill|stroke|stop-color)="#/);
    const stops = [...container.querySelectorAll('stop')];
    expect(stops).toHaveLength(4);
    expect(stops.map((s) => [...s.classList].filter((c) => !c.startsWith('svelte-')).join(' '))).toEqual(['stop win deep', 'stop win thin', 'stop loss thin', 'stop loss deep']);
  });
  it('점이 2개 미만이면 한 문장', () => {
    const { container } = render(GoldChart, { timeline: { minutes: [0] }, teams: DETAIL.teams });
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toContain('아직 골드 기록이 없습니다.');
  });
});

/** 17분 타임라인 — 탑·미드만 실렸다(정글·원딜·서폿은 양 팀 한 명씩이 아닌 판). 미드는 레드 우세 */
const MIN = Array.from({ length: 17 }, (_, i) => i);
const LANE_TL: MatchDetail['timeline'] = {
  minutes: MIN,
  a_gold: MIN.map((m) => 2500 + m * 600), b_gold: MIN.map((m) => 2500 + m * 500), gold_diff: MIN.map((m) => m * 100),
  cs_diff: MIN.map((m) => m), xp_diff: MIN.map(() => 0),
  lanes: {
    TOP: { gold: MIN.map((m) => m * 50), cs: MIN.map(() => 0) },
    MIDDLE: { gold: MIN.map((m) => -m * 100), cs: MIN.map((m) => -m) },
  },
};
const unitButtons = (c: Element) => [...c.querySelectorAll<HTMLButtonElement>('.units button')];
const foots = (c: Element) => [...c.querySelectorAll('.foot')].map((p) => p.textContent);

describe('GoldChart — 팀 · 라인 선택', () => {
  it('lanes 가 없는 발행물은 예전 그대로 — 선택 줄 없음, CS 줄 없음', () => {
    const { container } = render(GoldChart, { timeline: DETAIL.timeline, teams: DETAIL.teams });
    expect(container.querySelector('.units')).toBeNull();
    expect(foots(container)).toEqual(['최종 블루 +1,500G · 최대 격차 1,500G']);
    expect(container.querySelector('.legend')?.textContent).toContain('아래 판 · 골드 차이 = 블루 − 레드');
  });

  it('팀 + 다섯 라인, 실리지 않은 라인은 비활성. 처음은 팀(기존 팀 골드 차) + 팀 CS 차 줄', () => {
    const { container } = render(GoldChart, { timeline: LANE_TL, teams: DETAIL.teams });
    const bs = unitButtons(container);
    expect(bs.map((b) => b.textContent)).toEqual(['팀', '탑', '정글', '미드', '원딜', '서폿']);
    expect(bs.map((b) => b.disabled)).toEqual([false, false, true, false, true, true]);
    expect(bs.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false']);
    expect(container.querySelector('.units')?.getAttribute('aria-label')).toBe('골드 차이 대상');
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('골드 추이: 최종 블루 +1,600G · 최대 격차 1,600G');
    expect(foots(container)).toEqual(['최종 블루 +1,600G · 최대 격차 1,600G', 'CS 차 · 10분 +10 · 15분 +15 · 마지막 분 +16']);
  });

  it('라인을 누르면 아래 판 · 요약 · CS 줄이 그 라인 맞상대로, 위 판(팀 골드)은 그대로. 팀으로 되돌린다', async () => {
    const { container } = render(GoldChart, { timeline: LANE_TL, teams: DETAIL.teams });
    const svg = () => container.querySelector('svg')!;
    const teamA = svg().querySelector('polyline.ta')?.getAttribute('points');
    const teamDiff = svg().querySelector('polyline.diff')?.getAttribute('points');
    await fireEvent.click(unitButtons(container)[3]!);   // 미드
    expect(unitButtons(container).map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'true', 'false', 'false']);
    expect(svg().getAttribute('aria-label')).toBe('골드 추이 · 미드 골드 차이: 최종 레드 +1,600G · 최대 격차 1,600G');
    expect(container.querySelector('.legend')?.textContent).toContain('아래 판 · 미드 골드 차이 = 블루 − 레드');
    expect(foots(container)).toEqual(['최종 레드 +1,600G · 최대 격차 1,600G', 'CS 차 · 10분 −10 · 15분 −15 · 마지막 분 −16']);
    expect(svg().querySelector('polyline.ta')?.getAttribute('points')).toBe(teamA);
    expect(svg().querySelector('polyline.diff')?.getAttribute('points')).not.toBe(teamDiff);
    expect(svg().querySelector('circle.last')?.classList.contains('loss')).toBe(true);   // 레드(진 팀) 우세
    expect(pts(svg().querySelector('polyline.diff'))).toHaveLength(17);   // 차트는 하나 — 선만 바뀐다
    expect(container.querySelectorAll('svg')).toHaveLength(1);

    await fireEvent.click(unitButtons(container)[0]!);   // 팀
    expect(svg().querySelector('polyline.diff')?.getAttribute('points')).toBe(teamDiff);
    expect(foots(container)[1]).toBe('CS 차 · 10분 +10 · 15분 +15 · 마지막 분 +16');
  });

  it('고른 라인이 실리지 않은 경기로 바뀌면 팀으로 본다', async () => {
    const { container, rerender } = render(GoldChart, { timeline: LANE_TL, teams: DETAIL.teams });
    await fireEvent.click(unitButtons(container)[3]!);   // 미드
    await rerender({ timeline: { ...LANE_TL, lanes: { TOP: LANE_TL.lanes!.TOP! } }, teams: DETAIL.teams });
    expect(unitButtons(container).map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false']);
    expect(unitButtons(container)[3]!.disabled).toBe(true);
    expect(foots(container)[1]).toBe('CS 차 · 10분 +10 · 15분 +15 · 마지막 분 +16');
  });

  it('lanes 가 빈 사전(어느 라인도 한 명씩이 아님)이면 라인 다섯 모두 비활성, 팀 CS 줄은 있다', () => {
    const { container } = render(GoldChart, { timeline: { ...LANE_TL, lanes: {} }, teams: DETAIL.teams });
    expect(unitButtons(container).map((b) => b.disabled)).toEqual([false, true, true, true, true, true]);
    expect(foots(container)[1]).toBe('CS 차 · 10분 +10 · 15분 +15 · 마지막 분 +16');
  });
});

describe('KillMap', () => {
  it('점마다 잡은 팀 class · 처형은 사각형 · <title> 툴팁 · 범례 수', () => {
    const dots = killDots(DETAIL.kills, DETAIL.teams);
    const { container } = render(KillMap, { dots, selected: 1 });
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-label')).toBe('킬 지도: 3킬 · 이긴 팀 1 · 진 팀 1 · 처형 1');
    expect(svg.querySelectorAll('circle.dot.win')).toHaveLength(1);
    expect(svg.querySelectorAll('circle.dot.loss')).toHaveLength(1);
    expect(svg.querySelectorAll('rect.dot.exec')).toHaveLength(1);
    expect([...svg.querySelectorAll('.dot title')].map((t) => t.textContent)).toEqual(['5분 · 가 → 라', '12분 · 다 → 나', '20분 · 처형(포탑 · 미니언) → 가']);
    // 라이엇 y 는 위로 자란다 → 아래 기준
    const first = svg.querySelector('circle.dot.win')!;
    expect(first.getAttribute('cx')).toBe('61.1');
    expect(first.getAttribute('cy')).toBe('41.4');
    expect(svg.querySelector('.dot.on')?.classList.contains('loss')).toBe(true);
    expect(noHexAttrs(svg)).toBe(true);
    expect(container.querySelector('.legend')?.textContent).toContain('왼쪽 아래가 블루 진영');
  });
  it('킬이 없으면 한 문장', () => {
    const { container } = render(KillMap, { dots: [] });
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toContain('아직 킬 기록이 없습니다.');
  });
});

describe('KdaTimeline', () => {
  it('표식 class k/d/a · 5분 눈금 · <title> · 범례 수', () => {
    const p = DETAIL.teams[0]!.players[0]!;
    const { container } = render(KdaTimeline, { props: { events: p.kda_events, duration: DETAIL.duration, champKo: CHAMP_KO, name: '가' } });
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-label')).toBe('킬 · 데스 · 어시 타임라인: 가 킬 1 데스 2 어시 1');
    expect([...svg.querySelectorAll('circle.mark')].map((c) => [...c.classList].filter((x) => !x.startsWith('svelte-')).join(' '))).toEqual(['mark d', 'mark a', 'mark k', 'mark d']);
    expect([...svg.querySelectorAll('.mark title')].map((t) => t.textContent)).toEqual(['9분 데스 · 레넥톤', '9분 어시 · 신 짜오', '15분 킬 · 레넥톤', '25분 데스 · 처형(포탑 · 미니언)']);
    expect([...svg.querySelectorAll('text.tk')].map((t) => t.textContent)).toEqual(['0분', '5분', '10분', '15분', '20분', '25분', '30분']);
    expect(noHexAttrs(svg)).toBe(true);
    expect(container.querySelector('.legend')?.textContent?.replace(/\s+/g, ' ')).toContain('킬 1');
  });
  it('사건이 없으면 한 문장', () => {
    const { container } = render(KdaTimeline, { props: { events: [], duration: 100 } });
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toContain('기록이 없습니다.');
  });
});

describe('DmgBars', () => {
  it('팀마다 표 하나, 막대는 양 팀 최대 기준(--bar), 색은 결과 class', () => {
    const { container } = render(DmgBars, { teams: DETAIL.teams, champKo: CHAMP_KO, patch: '16.18.1' });
    const tables = [...container.querySelectorAll('table')];
    expect(tables.map((t) => t.getAttribute('aria-label'))).toEqual(['딜량 · 블루팀 · 승', '딜량 · 레드팀 · 패']);
    const blue = [...tables[0]!.querySelectorAll('tbody tr')];
    expect(blue.map((tr) => tr.querySelector('td.c0')?.textContent?.trim())).toEqual(['나', '가']);   // 라인 순
    const bars = blue.map((tr) => tr.querySelector('td.bar') as HTMLElement);
    expect(bars[1]!.style.getPropertyValue('--bar')).toBe('100%');   // 39,324 가 최대
    expect(bars[0]!.style.getPropertyValue('--bar')).toBe('30.5%');
    expect(bars[1]!.textContent).toBe('39.3K');
    expect(bars[0]!.classList.contains('win')).toBe(true);
    expect(tables[1]!.querySelector('td.bar')?.classList.contains('loss')).toBe(true);
    expect((tables[1]!.querySelectorAll('td.bar')[1] as HTMLElement).style.getPropertyValue('--bar')).toBe('63.6%');
    expect(tables[0]!.querySelectorAll('img.champ')).toHaveLength(2);
    expect(noHexAttrs(container)).toBe(true);
  });
});
