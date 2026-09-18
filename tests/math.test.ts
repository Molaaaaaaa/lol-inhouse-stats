import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import Math_ from '../src/routes/Math.svelte';
import MetricGuide from '../src/routes/math/MetricGuide.svelte';
import CpFormula from '../src/routes/math/CpFormula.svelte';
import { app } from '../src/lib/data/store.svelte';
import { router } from '../src/lib/router.svelte';
import type { GuildPayload } from '../src/lib/data/types';

// 지표 안내는 metric_groups 순서·metric_meta·lower_better 만 읽는다
const META = {
  gold_diff_10: { label: '골드차@10', lane: true, fmt: '', desc: '10분 시점 골드 차이. 대회 지표는 GD10 입니다.' },
  kda: { label: 'KDA', lane: false, fmt: '', desc: '(킬+어시)÷데스. **누적**입니다 — 판별 KDA 를 평균 내면 한 판이 전체를 지배합니다.' },
  deaths_per_game: { label: '판당 데스', lane: false, fmt: '', desc: '판당 데스 수. **적을수록 좋습니다.**' },
  cspm: { label: '분당 CS', lane: true, fmt: '', desc: '1분당 CS. 대회 지표는 CSM 입니다.' },
};
const PAYLOAD = {
  metric_meta: META,
  metric_groups: [{ group: '라인전', metrics: ['gold_diff_10', 'cspm'] }, { group: '종합', metrics: ['kda', 'deaths_per_game'] }],
  lower_better: ['deaths_per_game'],
} as unknown as GuildPayload;

const cells = (tr: Element) => [...tr.querySelectorAll('td:not(.rn)')].map((td) => td.textContent?.trim());

describe('MetricGuide — 지표 안내 표', () => {
  it('metric_groups 순서로 68개든 4개든 그대로 · 코드 판은 설명에 든 것만 · 강조 표식 제거 · 라인별·방향은 글자로', () => {
    const { container } = render(MetricGuide, { data: PAYLOAD });
    const table = screen.getByRole('table', { name: '지표 4개 · 발행 순서' });
    const rows = [...table.querySelectorAll('tbody tr')];
    expect(rows.map(cells)).toEqual([
      ['골드차@10', 'GD10', '라인전', '라인별', '높을수록 좋음', '10분 시점 골드 차이. 대회 지표는 GD10 입니다.'],
      ['분당 CS', 'CSM', '라인전', '라인별', '높을수록 좋음', '1분당 CS. 대회 지표는 CSM 입니다.'],
      // KDA 의 설명에 든 'KDA' 는 지표 이름이지 대회식 코드가 아니다
      ['KDA', '', '종합', '전체', '높을수록 좋음', '(킬+어시)÷데스. 누적입니다 — 판별 KDA 를 평균 내면 한 판이 전체를 지배합니다.'],
      ['판당 데스', '', '종합', '전체', '낮을수록 좋음', '판당 데스 수. 적을수록 좋습니다.'],
    ]);
    expect(container.textContent).not.toContain('**');
    // 안내 표는 접지 않고, 설명 셀만 줄이 접힌다
    expect(container.querySelector('.more')).toBeNull();
    expect(rows[0]!.querySelector('td.wrap')?.textContent).toContain('10분 시점');
  });
  it('레지스트리가 없으면 빈 상태 문장', () => {
    const { container } = render(MetricGuide, { data: null });
    expect(container.querySelector('.empty')?.textContent).toBe('아직 표시할 데이터가 없습니다.');
  });
});

describe('CpFormula — 상수 없음', () => {
  it('cp_constants 가 없으면 빈 상태 문장, 계산식 없음', () => {
    const { container } = render(CpFormula, { data: null });
    expect(container.querySelector('.cpf')).toBeNull();
    expect(container.querySelector('.empty')?.textContent).toBe('아직 계산식을 표시할 데이터가 없습니다.');
  });
});

describe('Math — 하위 화면', () => {
  beforeEach(() => {
    cleanup();
    location.hash = '';
    app.data = PAYLOAD;
    app.status = 'ready';
    router.start();
  });
  afterEach(() => { router.stop(); });

  it("sub 'metrics' → 지표 설명 탭·패널, 그 밖은 티어 계산식", () => {
    render(Math_, { sub: 'metrics', params: {} });
    expect(screen.getByRole('tab', { name: '지표 설명', selected: true })).toBeTruthy();
    expect(screen.getByRole('tabpanel').id).toBe('math-panel-metrics');
    expect(screen.getByRole('table', { name: /지표 4개/ })).toBeTruthy();
    cleanup();
    render(Math_, { sub: 'whatever', params: {} });
    expect(screen.getByRole('tab', { name: '티어 계산식', selected: true })).toBeTruthy();
    expect(screen.getByRole('tabpanel').id).toBe('math-panel-cp');
    // 이 픽스처엔 cp_constants 가 없다 — 계산식 자리에 빈 상태 문장
    expect(screen.getByText('아직 계산식을 표시할 데이터가 없습니다.')).toBeTruthy();
  });
  it('탭을 누르면 라우트가 바뀐다(#/math/metrics)', async () => {
    render(Math_, { sub: 'cp', params: {} });
    screen.getByRole('tab', { name: '지표 설명' }).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(location.hash).toBe('#/math/metrics');
  });
});
