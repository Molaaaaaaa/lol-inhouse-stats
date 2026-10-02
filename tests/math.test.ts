import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import Math_ from '../src/routes/Math.svelte';
import MetricGuide from '../src/routes/math/MetricGuide.svelte';
import { app } from '../src/lib/data/store.svelte';
import { parseHash, router } from '../src/lib/router.svelte';
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

describe('Math — 지표 안내 한 화면', () => {
  beforeEach(() => {
    cleanup();
    location.hash = '';
    app.data = PAYLOAD;
    app.status = 'ready';
    router.start();
  });
  afterEach(() => { router.stop(); });

  it('하위 화면이 없다 — 탭 줄 없이 지표 안내 표만 그린다', () => {
    render(Math_, { sub: 'metrics', params: {} });
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('table', { name: /지표 4개/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '지표 안내', hidden: true })).toBeTruthy();
  });
  it('#/math 의 기본은 metrics, 옛 주소 #/math/cp 도 같은 지표 안내로 떨어진다', () => {
    expect(parseHash('#/math').sub).toBe('metrics');
    for (const hash of ['#/math', '#/math/metrics', '#/math/cp', '#/math/whatever']) {
      const r = parseHash(hash);
      expect(r.section).toBe('math');
      expect(r.unknown).toBe(false);
      cleanup();
      render(Math_, { sub: r.sub, params: r.params });
      expect(screen.getByRole('table', { name: /지표 4개/ }), hash).toBeTruthy();
      expect(document.body.textContent, hash).not.toMatch(/계산식|티어|MMR|CP/);
    }
  });
});
