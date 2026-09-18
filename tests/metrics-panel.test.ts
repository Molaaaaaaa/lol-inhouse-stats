import '@testing-library/svelte/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import Metrics from '../src/routes/member/Metrics.svelte';
import type { GuildPayload, LaneId, MetricCell, PlayerPub } from '../src/lib/data/types';

const cell = (value: number, games: number, rank: number, n: number, pct: number, lane: LaneId | null = null): MetricCell =>
  ({ value, games, rank, n, pct, lane });

const DATA = {
  min_games: 5, min_games_lane: 3, patch: '16.18.1', champ_ko: {},
  lower_better: ['time_dead'],
  metric_groups: [
    { group: '종합', metrics: ['dpm', 'kp'] },
    { group: '라인전', metrics: ['gold_diff_10', 'cs10'] },
    { group: '생존', metrics: ['time_dead'] },
  ],
  metric_meta: {
    dpm: { label: '분당 딜', lane: false, fmt: '', desc: '1분당 챔피언에게 넣은 피해.' },
    kp: { label: '킬 관여', lane: false, fmt: 'pct', desc: '킬 관여율.' },
    gold_diff_10: { label: '골드차@10', lane: true, fmt: '', desc: '10분 시점 골드 차이. 대회 지표의 GD10 입니다.' },
    cs10: { label: 'CS@10', lane: true, fmt: '', desc: '10분 시점 내가 먹은 CS.' },
    time_dead: { label: '죽어 있던 시간', lane: false, fmt: 'sec', desc: '누워 있던 시간.' },
  },
} as unknown as GuildPayload;

const P = {
  name: '도영',
  metrics: {
    dpm: cell(836.28, 29, 4, 25, 0.86),
    kp: cell(0.612, 29, 2, 25, 0.94),
    gold_diff_10: cell(120.5, 19, 9, 29, 0.707, 'BOTTOM'),
    cs10: cell(77.1, 2, 9, 29, 0.707, 'BOTTOM'),
    time_dead: cell(95, 29, 3, 25, 0.9),
  },
  metrics_lane: {
    BOTTOM: { gold_diff_10: cell(120.5, 19, 9, 29, 0.707, 'BOTTOM'), cs10: cell(77.1, 2, 9, 29, 0.707, 'BOTTOM') },
    JUNGLE: { cs10: cell(65.1, 7, 9, 13, 0.346, 'JUNGLE') },
  },
} as unknown as PlayerPub;

const caps = (el: HTMLElement) => [...el.querySelectorAll('.cap')].map((c) => c.textContent);
const heads = (table: Element) => [...table.querySelectorAll('thead th[scope="col"]')].map((h) => h.textContent);
const tableOf = (el: HTMLElement, caption: string) => el.querySelector(`table[aria-label="${caption}"]`)!;
const pills = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('.pill')];

beforeEach(() => { location.hash = ''; });

describe('Metrics — 통합 보기', () => {
  it('metric_groups 순서로 그룹마다 표 하나 · 캡션 = 그룹 이름', () => {
    const { container } = render(Metrics, { key: 'p1', p: P, data: DATA });
    expect(caps(container)).toEqual(['종합', '라인전', '생존']);
    expect(container.querySelectorAll('table')).toHaveLength(3);
  });
  it('열: 지표·값·판수·순위·백분위(scope=col) · 라인 열은 라인별 지표가 있는 그룹에만 · 행 번호 홈통', () => {
    const { container } = render(Metrics, { key: 'p1', p: P, data: DATA });
    expect(heads(tableOf(container, '종합'))).toEqual(['지표', '값', '판수', '순위', '백분위']);
    expect(heads(tableOf(container, '라인전'))).toEqual(['지표', '라인', '값', '판수', '순위', '백분위']);
    expect([...tableOf(container, '종합').querySelectorAll('tbody td.rn')].map((td) => td.textContent)).toEqual(['1', '2']);
  });
  it('셀: 라벨은 metric_meta.label · 코드 판은 설명에 코드가 있을 때만 · 라인 셀은 띠 클래스 · 값 서식 · 순위 rank/n · 백분위 %', () => {
    const { container } = render(Metrics, { key: 'p1', p: P, data: DATA });
    const rows = tableOf(container, '라인전').querySelectorAll('tbody tr');
    const cells = [...rows[0]!.querySelectorAll('td:not(.rn)')].map((td) => td.textContent?.trim());
    expect(cells).toEqual(['골드차@10GD10', '원딜', '120.5', '19', '9/29', '71%']);
    expect(rows[0]!.querySelector('td.c0 .plate')?.textContent).toBe('GD10');
    expect(rows[1]!.querySelector('td.c0 .plate')).toBeNull();     // CS@10 설명에는 코드가 없다
    expect(rows[0]!.querySelector('td:nth-child(3)')!.classList.contains('lane-bot')).toBe(true);
    const kp = tableOf(container, '종합').querySelectorAll('tbody tr')[1]!;
    expect(kp.textContent).toContain('61%');
  });
  it('백분위 막대는 절대 눈금 --bar 로 셀에 · 낮을수록 좋은 지표는 막대 없음(값 글자는 남는다)', () => {
    const { container } = render(Metrics, { key: 'p1', p: P, data: DATA });
    const all = tableOf(container, '종합');
    const bars = [...all.querySelectorAll<HTMLElement>('tbody tr td.bar')].map((td) => td.style.getPropertyValue('--bar'));
    expect(bars).toEqual(['86%', '94%']);   // 열 최대값(94)에 맞춰 늘리지 않는다
    const deadRow = tableOf(container, '생존').querySelector('tbody tr')!;
    expect(deadRow.querySelector('td.bar')).toBeNull();
    expect(deadRow.querySelector('td:last-child')?.textContent?.trim()).toBe('90%');
  });
  it('문턱 미만 행은 .thin — 판수는 그대로 적혀 있다', () => {
    const { container } = render(Metrics, { key: 'p1', p: P, data: DATA });
    const rows = tableOf(container, '라인전').querySelectorAll('tbody tr');
    expect(rows[0]!.classList.contains('thin')).toBe(false);
    expect(rows[1]!.classList.contains('thin')).toBe(true);
    expect(rows[1]!.textContent).toContain('2');
  });
  it('행 선택 → 그 지표의 순위 화면(라인별 지표는 대표 라인까지)', async () => {
    const { container } = render(Metrics, { key: 'p1', p: P, data: DATA });
    await fireEvent.click(tableOf(container, '종합').querySelector('tbody tr')!);
    expect(location.hash).toBe('#/rank/metric/dpm');
    await fireEvent.click(tableOf(container, '라인전').querySelector('tbody tr')!);
    expect(location.hash).toBe('#/rank/metric/gold_diff_10/BOTTOM');
  });
  it('안내문: 문턱과 막대 규칙, 이동 안내', () => {
    const { container } = render(Metrics, { key: 'p1', p: P, data: DATA });
    const note = container.querySelector('.note')!.textContent!;
    expect(note).toContain('5판(라인별 지표 3판) 미만');
    expect(note).toContain('낮을수록 좋은 지표는 막대를 그리지 않습니다');
    expect(note).toContain('방 전체');
  });
});

describe('Metrics — 라인 알약 줄', () => {
  it('라인이 2개 이상이면 전체 + 라인(탑→서폿 순) · 기본은 전체(aria-pressed)', () => {
    const { container } = render(Metrics, { key: 'p1', p: P, data: DATA });
    const ps = pills(container);
    expect(ps.map((b) => b.textContent)).toEqual(['전체', '정글', '원딜']);
    expect(ps.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(container.querySelector('.lanes')?.getAttribute('aria-label')).toBe('라인 선택');
  });
  it('라인을 누르면 그 라인의 지표만 · 라인 열 없음 · 문턱은 라인별 · 힌트가 바뀐다', async () => {
    const { container } = render(Metrics, { key: 'p1', p: P, data: DATA });
    await fireEvent.click(pills(container)[1]!);   // 정글
    expect(pills(container).map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect(caps(container)).toEqual(['라인전']);
    const t = tableOf(container, '라인전');
    expect(heads(t)).toEqual(['지표', '값', '판수', '순위', '백분위']);   // 라인 열 없음
    expect(t.querySelector('tbody tr')!.classList.contains('thin')).toBe(false);   // 7판 ≥ 3
    expect(container.querySelector('.hint')!.textContent).toContain('정글 출전 판만 집계');
    expect(container.querySelector('.note')!.textContent).toContain('정글 출전 멤버');
    await fireEvent.click(t.querySelector('tbody tr')!);
    expect(location.hash).toBe('#/rank/metric/cs10/JUNGLE');
  });
  it('라인이 하나뿐이면 알약 줄이 없다', () => {
    const p1 = { ...P, metrics_lane: { BOTTOM: P.metrics_lane!.BOTTOM } } as PlayerPub;
    const { container } = render(Metrics, { key: 'p1', p: p1, data: DATA });
    expect(container.querySelector('.lanes')).toBeNull();
  });
  it('통합 지표가 없으면(문턱 미만) 전체 알약이 없고 첫 라인이 기본', () => {
    const thin = { name: '새 멤버', metrics_lane: P.metrics_lane } as unknown as PlayerPub;
    const { container } = render(Metrics, { key: 'p9', p: thin, data: DATA });
    expect(pills(container).map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([['정글', 'true'], ['원딜', 'false']]);
    expect(caps(container)).toEqual(['라인전']);
    expect(container.querySelector('.empty')).toBeNull();
  });
  it('지표가 하나도 없으면 빈 상태만', () => {
    const none = { name: '빈' } as unknown as PlayerPub;
    const { container } = render(Metrics, { key: 'p9', p: none, data: DATA });
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('.lanes')).toBeNull();
    expect(container.querySelector('.empty')?.textContent).toContain('아직 세부 지표가 없습니다');
  });
});
