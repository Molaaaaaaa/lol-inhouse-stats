import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import Radar from '../src/components/charts/Radar.svelte';
import Donut from '../src/components/charts/Donut.svelte';
import AxisBars from '../src/components/charts/AxisBars.svelte';
import { META, PAYLOAD, PROFILE } from './fixtures/member-payload';

const SCALE = PAYLOAD.profile_scale;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
/** SVG 안 모든 속성값에 hex 색이 없는가 — 색은 class → CSS 토큰으로만 */
function noHexAttrs(svg: Element): boolean {
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    for (const a of el.getAttributeNames()) if (HEX.test(el.getAttribute(a) ?? '')) return false;
  }
  return true;
}
const pts = (el: Element | null) => (el?.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean);

afterEach(cleanup);

describe('Radar', () => {
  it('6축 → 채움 다각형 꼭짓점 6개, 눈금 링 rings 개, 점 6개, 라벨·점수 글자', () => {
    const { container } = render(Radar, { axes: PROFILE, scale: SCALE, minGames: 5 });
    const svg = container.querySelector('svg')!;
    expect(svg).not.toBeNull();
    expect(pts(svg.querySelector('polygon.area'))).toHaveLength(6);
    expect(svg.querySelectorAll('polygon.ring')).toHaveLength(SCALE.rings);
    expect(pts(svg.querySelector('polygon.ring'))).toHaveLength(6);
    expect(svg.querySelectorAll('line.spoke')).toHaveLength(6);
    expect(svg.querySelectorAll('circle.dot')).toHaveLength(6);
    expect(pts(svg.querySelector('polygon.avg'))).toHaveLength(6);
    const labels = [...svg.querySelectorAll('text.lbl')].map((t) => t.textContent);
    expect(labels).toEqual(['공격', '라인전', '생존', '교전', '시야', '개인기']);
    const vals = [...svg.querySelectorAll('text.val')].map((t) => t.textContent);
    expect(vals).toEqual(['3.86', '2.06', '3.02', '2.94', '1.35', '3.31']);
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toContain('공격 3.86');
  });
  it('SVG 속성에 hex 없음 — 색은 class 만', () => {
    const { container } = render(Radar, { axes: PROFILE, scale: SCALE });
    expect(noHexAttrs(container.querySelector('svg')!)).toBe(true);
    expect(container.innerHTML).not.toMatch(/(fill|stroke)="#/);
  });
  it('축이 3개 미만이면 그리지 않고 한 문장', () => {
    const { container } = render(Radar, { axes: PROFILE.slice(0, 2), scale: SCALE });
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toContain('판수가 부족해 능력치를 표시할 수 없습니다.');
  });
  it('눈금 step 이 0.1 이상이면 점수 한 자리', () => {
    const { container } = render(Radar, { axes: PROFILE, scale: { ...SCALE, step: 0.5 } });
    expect(container.querySelector('text.val')?.textContent).toBe('3.9');
  });
});

describe('Donut', () => {
  it('라인 여러 개 → 조각 path 에 라인 class, 가운데 총 판수, 범례 글자', () => {
    const dist = PAYLOAD.players.p1!.role_dist;
    const { container } = render(Donut, { dist });
    const svg = container.querySelector('svg')!;
    const segs = [...svg.querySelectorAll('path.seg')];
    expect(segs.map((s) => s.classList.contains('bot') || s.classList.contains('jg') || s.classList.contains('mid'))).toEqual([true, true, true]);
    expect(svg.querySelector('text.tot')?.textContent).toBe('29');
    expect(noHexAttrs(svg)).toBe(true);
    const legend = [...container.querySelectorAll('.legend li')].map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
    expect(legend).toEqual(['원딜 19판', '정글 7판', '미드 3판']);
  });
  it('한 라인만 뛰었으면 path 대신 원(circle) — 빈 칸이 아니다', () => {
    const { container } = render(Donut, { dist: [{ lane: 'TOP', games: 3, pct: 1 }] });
    expect(container.querySelector('path.seg')).toBeNull();
    expect(container.querySelector('circle.seg.top')).not.toBeNull();
    expect(container.querySelector('text.tot')?.textContent).toBe('3');
  });
  it('출전 기록이 없으면 한 문장', () => {
    const { container } = render(Donut, { dist: [] });
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toContain('아직 출전 기록이 없습니다.');
  });
});

describe('AxisBars', () => {
  it('축마다 점수(막대 --bar)·순위·변화 ▲▼·판, 문턱 미만은 thin', () => {
    const { container } = render(AxisBars, { axes: PROFILE, scale: SCALE, minGames: 20, meta: META });
    const rows = [...container.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(6);
    const first = rows[0]!;
    const tds = [...first.querySelectorAll('td')].map((td) => td.textContent?.trim());
    expect(tds).toEqual(['공격', '3.86', '4/25위', '▼0.48', '29']);
    expect((first.querySelector('td.bar') as HTMLElement).style.getPropertyValue('--bar')).toBe('77.2%');
    expect(first.querySelector('td.ax')?.getAttribute('title')).toBe('분당 딜 836.28 · 딜 비중 23%');
    expect(rows[1]!.classList.contains('thin')).toBe(true);   // 라인전 19판 < 20
    expect(rows[3]!.querySelectorAll('td')[3]!.textContent).toBe('▲0.40');
    expect(rows[4]!.querySelectorAll('td')[3]!.textContent).toBe('');
    expect(container.querySelector('table')?.getAttribute('aria-label')).toBe('능력치 축');
  });
});
