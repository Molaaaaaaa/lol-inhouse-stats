import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import Home from '../src/routes/Home.svelte';
import { app } from '../src/lib/data/store.svelte';
import { router } from '../src/lib/router.svelte';
import { clearFx, fx } from '../src/lib/fx.svelte';
import type { CpConstants, CpEntry, CpLane, GuildPayload, LaneId, PlayerPub } from '../src/lib/data/types';

// 작은 payload — 홈은 summary·timestamp·cp·cp_constants·players·metric_meta·min_games* 만 읽는다
function lane(games: number, mmr: number): CpLane {
  return { games, mmr, placed: games >= 5, dev: 0, strength: 0 };
}
function entry(name: string, cp: number, mmr: number, games: number, main: LaneId, lanes: Partial<Record<LaneId, CpLane>>): CpEntry {
  const tier = cp >= 1150 ? '1티어' : cp >= 1050 ? '2티어' : cp >= 950 ? '3티어' : '4티어';
  return { name, games, main_lane: main, mmr, cp, tier, points: cp % 100, to_next: 100 - (cp % 100), placed: games >= 5, lanes, replay: [] };
}
function player(name: string, games: number, winrate: number, lanes: { lane: LaneId; games: number; winrate: number }[]): PlayerPub {
  return { name, record: { games, winrate, wins: Math.round(games * winrate), losses: 0 }, lanes } as unknown as PlayerPub;
}
const CONST = {
  placement_games: 5, k_place: 64, k_norm: 32, k_decay_half: 20, k_min: 16,
  mmr_base: 1000, cp_base: 1000, cp_min: 15, cp_max: 25, cp_size: 40, e_clamp: 0.375,
  cp_gap_div: 4, cp_gap_cap: 5, cp_adj_w: 16, tier_points: 100,
  tiers: [
    { name: '1티어', cp: 1150, open_top: true }, { name: '2티어', cp: 1050, open_top: false },
    { name: '3티어', cp: 950, open_top: false }, { name: '4티어', cp: 850, open_top: false },
    { name: '5티어', cp: null, open_top: false },
  ],
  lane_prior_k: 5, off_lane_prior: -30, dev_scale: 200, dev_cap: 120,
  perf_w: 0.5, lean_w: 0, lean_ref: 100, perf_elo_per_z: 0, perf_shrink_k: 2, perf_z_cap: 1,
  contrib_lo: 0.7, contrib_hi: 1.3, contrib_z_scale: 0.15, lane_base_k: 12,
  contrib_weights: { kp: 0.15, dmg_share: 0.4, kda_n: 0.45 },
} satisfies CpConstants;

const PAYLOAD = {
  name: '테스트 방', patch: '15.18.1', timestamp: '2026-09-17T11:31:54+00:00',
  summary: { total_games: 57, player_count: 4, avg_winrate: 0.5, avg_duration_sec: 1686 },
  min_games: 5, min_games_excluded: 1, min_games_lane: 3, min_days: 1, min_days_excluded: 0,
  cp: {
    p1: entry('앙앙맹', 1135, 1185, 6, 'TOP', { TOP: lane(6, 1185), MIDDLE: lane(3, 1150) }),
    p2: entry('맹구', 980, 1010, 12, 'JUNGLE', { JUNGLE: lane(12, 1010) }),
    p3: entry('신입', 1090, 1120, 2, 'BOTTOM', { BOTTOM: lane(2, 1120) }),
    p4: entry('Faker', 1210, 1260, 20, 'MIDDLE', { MIDDLE: lane(20, 1260) }),
  },
  cp_constants: CONST,
  players: {
    p1: player('앙앙맹', 6, 1, [{ lane: 'TOP', games: 6, winrate: 1 }, { lane: 'MIDDLE', games: 3, winrate: 0.33 }]),
    p2: player('맹구', 12, 0.5, [{ lane: 'JUNGLE', games: 12, winrate: 0.5 }]),
    p3: player('신입', 2, 0, [{ lane: 'BOTTOM', games: 2, winrate: 0 }]),
    p4: player('Faker', 20, 0.7, [{ lane: 'MIDDLE', games: 20, winrate: 0.7 }]),
  },
  metric_meta: {
    winrate: { label: '승률', lane: false, fmt: 'pct', desc: '' },
    kp: { label: '킬 관여', lane: false, fmt: 'pct', desc: '' },
    dmg_share: { label: '딜 비중', lane: false, fmt: 'pct', desc: '' },
  },
  metric_groups: [], lower_better: [], baseline: null,
} as unknown as GuildPayload;

const TIER_WORD = /[1-5]티어/;
const table = () => screen.getByRole('table', { name: /사다리/ });
const bodyRows = () => [...table().querySelectorAll('tbody tr')] as HTMLTableRowElement[];
const cellTexts = (tr: HTMLTableRowElement) => [...tr.querySelectorAll('td:not(.rn)')].map((td) => td.textContent?.trim());
const nameOf = (tr: HTMLTableRowElement) => tr.querySelector('td.c0')?.textContent?.trim();
const pressed = (label: RegExp) => screen.getByRole('button', { pressed: true, name: label });

describe('Home — 첫 화면', () => {
  beforeEach(() => {
    cleanup();
    location.hash = '';
    clearFx();
    app.data = PAYLOAD;
    app.status = 'ready';
    router.start();
  });
  afterEach(() => { router.stop(); });

  it('한 줄 메타: 경기·멤버·평균 시간·갱신 시각', () => {
    const { container } = render(Home, { sub: '', params: {} });
    const meta = container.querySelector('.meta')!.textContent!.replace(/\s+/g, ' ');
    expect(meta).toContain('57경기');
    expect(meta).toContain('4명');
    expect(meta).toContain('평균 28분 06초');
    expect(meta).toMatch(/갱신 9\/17 \d\d:\d\d/);
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(PAYLOAD.timestamp);
  });

  it('기본은 라인별: 사람×라인(라인 3판 이상) 행, 라인 미완·배치 미완은 선 아래(unp)·순위 없음', () => {
    render(Home, { sub: '', params: {} });
    expect(pressed(/라인별/)).toBeTruthy();
    expect(table().getAttribute('aria-label')).toBe('사다리 · 라인별');
    const rows = bodyRows();
    // Faker 미드 · 앙앙맹 탑 · 맹구 정글 (라인 MMR 순) → 선 아래: 앙앙맹 미드(라인 3판, 배치 3/5)
    expect(rows.map(nameOf)).toEqual(['Faker', '앙앙맹', '맹구', '앙앙맹']);
    expect(rows.map((r) => r.classList.contains('unp'))).toEqual([false, false, false, true]);
    // 신입(원딜 2판)은 라인 문턱 미만이라 라인별 표에 없다
    expect(rows.map(nameOf)).not.toContain('신입');
    // 선 아래 행: 티어·CP 는 사람 것(배치 완료), 라인 MMR 은 점선(pend), 판 칸에 '배치 3/5'
    const mid = rows[3]!;
    expect(cellTexts(mid)).toEqual(['앙앙맹', '—', '미드', '2티어', '1135', '35', '1150', '배치 3/5', '33%']);
    expect(mid.querySelector('td.pend')?.textContent?.trim()).toBe('1150');
    // 주 라인 표시 · 라인 띠 클래스 · 순위 1~3 에 메달
    expect(cellTexts(rows[1]!)).toEqual(['앙앙맹', '2', '탑 · 주', '2티어', '1135', '35', '1185', '6', '100%']);
    expect(rows[1]!.querySelector('td.lane-top')).toBeTruthy();
    expect(rows[0]!.querySelector('td.medal.m1')?.textContent?.trim()).toBe('1');
    expect(rows[2]!.querySelector('td.medal.m3')?.textContent?.trim()).toBe('3');
  });

  it('통합으로 전환: 사람당 한 줄, 배치 미완은 맨 아래·티어 글자 없음·CP/MMR 비움, 라인 버튼 숫자 = 그 라인 행 수', async () => {
    render(Home, { sub: '', params: {} });
    await fireEvent.click(screen.getByRole('button', { name: '통합' }));
    expect(pressed(/통합/)).toBeTruthy();
    expect(table().getAttribute('aria-label')).toBe('사다리 · 통합');
    const rows = bodyRows();
    expect(rows.map(nameOf)).toEqual(['Faker', '앙앙맹', '맹구', '신입']);
    const last = rows[3]!;
    expect(last.classList.contains('unp')).toBe(true);
    expect(last.textContent).not.toMatch(TIER_WORD);
    expect(cellTexts(last)).toEqual(['신입', '—', '원딜', '배치 2/5', '—', '—', '—', '—', '2', '0%']);
    expect(last.querySelector('td.pend')?.textContent?.trim()).toBe('배치 2/5');
    expect(last.querySelector('td.t2, td.t3, td.t1')).toBeNull();
    // 배치 완료 행은 티어 채움 클래스 + 승급까지
    expect(rows[1]!.querySelector('td.t2')?.textContent?.trim()).toBe('2티어');
    expect(cellTexts(rows[1]!)).toEqual(['앙앙맹', '2', '탑', '2티어', '1135', '35', '65', '1185', '6', '100%']);
    // 라인 버튼 숫자: 탑 1 · 정글 1 · 미드 2 · 원딜 0 · 서폿 0
    const nums = ['탑', '정글', '미드', '원딜', '서폿'].map((l) => screen.getByRole('button', { name: new RegExp(`^${l} \\d`) }).textContent?.replace(/\s+/g, ' ').trim());
    expect(nums).toEqual(['탑 1', '정글 1', '미드 2', '원딜 0', '서폿 0']);
  });

  it('라인 하나: 그 라인을 뛴 사람만 · 표 머리 열 이름', async () => {
    render(Home, { sub: '', params: {} });
    await fireEvent.click(screen.getByRole('button', { name: /^미드/ }));
    expect(table().getAttribute('aria-label')).toBe('사다리 · 미드');
    expect(bodyRows().map(nameOf)).toEqual(['Faker', '앙앙맹']);
    const heads = [...table().querySelectorAll('thead th[scope="col"] .h')].map((h) => h.textContent);
    expect(heads).toEqual(['멤버', '순위', '라인', '티어', 'CP', '점수', '라인 MMR', '판', '승률']);
  });

  it('행 선택 → 수식 줄에 계산 근거, 같은 행 다시 선택 → 멤버 화면 · 보기 전환은 수식 줄을 비운다', async () => {
    render(Home, { sub: '', params: {} });
    expect(fx.text).toBe('');
    const row = bodyRows()[1]!;   // 앙앙맹 탑
    await fireEvent.click(row);
    expect(fx.text).toBe('=티어(CP 1135) → 2티어 35점 · 탑 MMR 1185 · 탑 6판');
    expect(row.getAttribute('aria-selected')).toBe('true');
    // 배치 미완 행은 티어 이름 없이 배치 진행만
    await fireEvent.click(bodyRows()[3]!);
    expect(fx.text).toBe('=티어(CP 1135) → 2티어 35점 · 미드 MMR 1150 · 미드 3판 (라인 배치 3/5)');
    await fireEvent.click(screen.getByRole('button', { name: '통합' }));
    expect(fx.text).toBe('');
    await fireEvent.click(bodyRows()[3]!);   // 신입(배치 미완)
    expect(fx.text).toBe('=배치(2/5판) → 티어 산정 전');
    expect(fx.text).not.toMatch(TIER_WORD);
    // 같은 행을 한 번 더 → 멤버 화면
    await fireEvent.click(bodyRows()[3]!);
    expect(location.hash).toBe('#/m/%EC%8B%A0%EC%9E%85');
  });

  it('Enter 로도 선택·이동한다 · 안내 문장(배치·문턱)과 계산식이 있다', async () => {
    const { container } = render(Home, { sub: '', params: {} });
    const row = bodyRows()[0]!;
    await fireEvent.keyDown(row, { key: 'Enter' });
    expect(fx.text).toContain('=티어(CP 1210)');
    await fireEvent.keyDown(row, { key: 'Enter' });
    expect(location.hash).toBe('#/m/Faker');
    const notes = [...container.querySelectorAll('p.note')].map((p) => p.textContent?.replace(/\s+/g, ' ').trim());
    expect(notes[0]).toContain('배치 5판 · 1명 배치 진행 중 · 배치 전에는 티어를 표시하지 않습니다.');
    expect(notes[0]).toContain('라인 5판부터 라인 배치 완료');
    expect(notes[1]).toContain('5판 이상 참여한 멤버만 집계합니다 (라인별 지표는 3판) · 1명은 판수 미달로 제외.');
    expect(screen.getByRole('button', { name: '최소 판수 설명' })).toBeTruthy();
    // 계산식 블록 — 숫자는 payload 에서
    const cpf = container.querySelector('.cpf')!;
    expect(cpf.querySelector('h2')?.textContent).toBe('티어 계산식');
    expect(cpf.textContent).toContain('K = 64 (배치 5판 동안) → 32 에서 시작해 20판마다 절반, 최소 16');
    expect(cpf.textContent).toContain('재료 = 킬 관여 15% · 딜 비중 40% · ln(1+KDA) 45%');
    expect(cpf.textContent).toContain('0.375~0.625');
    const cuts = [...cpf.querySelectorAll('table[aria-label="티어 컷"] tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent?.trim()));
    expect(cuts).toEqual([
      ['1티어', '1150 이상', '상한 없음'], ['2티어', '1050~1149', ''], ['3티어', '950~1049', ''],
      ['4티어', '850~949', ''], ['5티어', '849 이하', '최하위'],
    ]);
  });
});
