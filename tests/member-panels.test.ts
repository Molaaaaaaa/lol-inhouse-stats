import '@testing-library/svelte/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import Vs from '../src/routes/member/Vs.svelte';
import Recent from '../src/routes/member/Recent.svelte';
import Partners from '../src/routes/member/Partners.svelte';
import HourBars from '../src/components/charts/HourBars.svelte';
import { hourRows } from '../src/lib/member-rest';
import { app } from '../src/lib/data/store.svelte';
import type { GuildPayload, H2HEntry, PlayerPub } from '../src/lib/data/types';

const h2h = (o: Partial<H2HEntry>): H2HEntry => ({
  with_games: 0, with_wins: 0, with_winrate: null, vs_games: 0, a_wins: 0, b_wins: 0, a_winrate: null, lanes: [], ...o,
});

const ME = {
  name: '나',
  recent_games: [
    { game_creation: 1789483391629, champion_name: 'Gwen', lane: 'TOP', win: true, kda: 5, dpm: 987.7 },
    { game_creation: 1789486490844, champion_name: 'Zaahen', lane: 'TOP', win: false, kda: 5.75, dpm: 1239.7 },
    { game_creation: 1789479186226, champion_name: 'Kaisa', lane: 'BOTTOM', win: true, kda: 2.25, dpm: 806.7 },
  ],
  by_hour: [{ hour: 22, games: 2, winrate: 0.5 }, { hour: 0, games: 1, winrate: 1 }],
  partners_best: [
    { partner: '우체국집배원', games: 20, winrate: 0.55, synergy: 0.043 },
    { partner: '뚠댕뚠냥', games: 2, winrate: 1, synergy: 0.031 },
  ],
  partners_worst: [
    { partner: '외 걸', games: 13, winrate: 0.308, synergy: -0.065 },
    { partner: '앙앙맹', games: 4, winrate: 0, synergy: -0.056 },
  ],
  nemesis_victim: {
    nemesis: [{ vs_champ: 'Akali', games: 1, winrate: 0 }],
    victim: [{ vs_champ: 'Ezreal', games: 6, winrate: 1 }],
  },
  killer_champions: {
    killed: [{ champion: 'Jhin', n: 15 }, { champion: 'Rakan', n: 11 }],
    killed_by: [{ champion: 'Sylas', n: 9 }],
  },
} as unknown as PlayerPub;

const DATA = {
  min_games: 5, min_games_lane: 3, patch: '16.18.1',
  champ_ko: { Gwen: '그웬', Zaahen: '자헨', Kaisa: '카이사', Akali: '아칼리', Ezreal: '이즈리얼', Jhin: '진', Rakan: '라칸', Sylas: '사일러스' },
  metric_meta: {
    kda: { label: 'KDA', lane: false, fmt: '', desc: '' }, dpm: { label: '분당 딜', lane: false, fmt: '', desc: '' },
    winrate: { label: '승률', lane: false, fmt: 'pct', desc: '' },
  },
  players: { p1: ME, p2: { name: '상대A' }, p3: { name: '상대B' }, p4: { name: '안 만남' } },
  h2h: {
    'p1|p2': h2h({ vs_games: 4, a_wins: 3, b_wins: 1, with_games: 2, with_wins: 2 }),
    'p3|p1': h2h({ vs_games: 6, a_wins: 5, b_wins: 1, with_games: 8, with_wins: 3 }),
  },
  fun: { kill_matrix: [{ killer: '나', victim: '상대A', kills: 5 }, { killer: '상대B', victim: '나', kills: 7 }] },
} as unknown as GuildPayload;

const heads = (table: Element) => [...table.querySelectorAll('thead th[scope="col"] .h')].map((h) => h.textContent);
const tableOf = (el: HTMLElement, caption: string) => el.querySelector(`table[aria-label="${caption}"]`)!;
const rowCells = (tr: Element) => [...tr.querySelectorAll('td:not(.rn)')].map((td) => td.textContent?.trim());

// 초상(ChampImg)의 패치는 DataTable 이 전역 store 에서 읽는다 — 화면과 같은 조건으로
beforeEach(() => { location.hash = ''; app.data = DATA; app.status = 'ready'; });

describe('Vs — 상대별 전적', () => {
  it('열 · 함께 판 ↓ 기본 정렬(aria-sort) · 내 기준 승패', () => {
    const { container } = render(Vs, { key: 'p1', p: ME, data: DATA });
    const t = tableOf(container, '상대별 전적');
    expect(heads(t)).toEqual(['상대', '함께 판', '함께 승률', '맞대결 판', '맞대결 승률', '킬', '데스']);
    const rows = t.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    // 상대B: 키가 p3|p1 이라 내가 b 쪽 — 내 승 1, 상대 승 5 (뒤집어 읽는다)
    expect(rowCells(rows[0]!)).toEqual(['상대B', '8', '38%', '6', '17%', '0', '7']);
    expect(rowCells(rows[1]!)).toEqual(['상대A', '2', '100%', '4', '75%', '5', '0']);
    expect([...t.querySelectorAll('thead th[scope="col"]')][1]!.getAttribute('aria-sort')).toBe('descending');
  });
  it('승률 채움은 문턱(5판) 이상만 — 2판 100% 는 채우지 않는다', () => {
    const { container } = render(Vs, { key: 'p1', p: ME, data: DATA });
    const rows = tableOf(container, '상대별 전적').querySelectorAll('tbody tr');
    const cellsB = rows[0]!.querySelectorAll('td:not(.rn)');
    expect(cellsB[2]!.classList.contains('loss')).toBe(true);    // 함께 8판 38%
    expect(cellsB[4]!.classList.contains('loss')).toBe(true);    // 맞대결 6판 17%
    const cellsA = rows[1]!.querySelectorAll('td:not(.rn)');
    expect(cellsA[2]!.classList.contains('win')).toBe(false);    // 2판
    expect(cellsA[4]!.classList.contains('win')).toBe(false);    // 4판
  });
  it('뜻풀이 한 줄(행 합계는 없다 — 한 판이 상대마다 세어진다) · 행 선택 → 그 멤버 화면', async () => {
    const { container } = render(Vs, { key: 'p1', p: ME, data: DATA });
    const notes = [...container.querySelectorAll('.note')].map((n) => n.textContent?.replace(/\s+/g, ' ').trim());
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('함께 = 한 팀이었던 판');
    expect(notes[0]).toContain('5판 이상부터');
    expect(container.textContent).not.toContain('합계');
    await fireEvent.click(tableOf(container, '상대별 전적').querySelector('tbody tr')!);
    expect(location.hash).toBe(`#/m/${encodeURIComponent('상대B')}`);
  });
  it('만난 사람이 없으면 빈 상태, 안내 줄 없음', () => {
    const lone = { ...DATA, h2h: {} } as GuildPayload;
    const { container } = render(Vs, { key: 'p1', p: ME, data: lone });
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('.empty')).not.toBeNull();
    expect(container.querySelector('.note')).toBeNull();
  });
});

describe('Recent — 최근 경기 · 시간대', () => {
  it('열 머리(지표 이름은 metric_meta) · 시각 ↓ 정렬 · 챔피언 한글 · 라인 띠 · 승패 채움과 글자', () => {
    const { container } = render(Recent, { key: 'p1', p: ME, data: DATA });
    const t = tableOf(container, '최근 경기');
    expect(heads(t)).toEqual(['시각', '챔피언', '라인', '결과', 'KDA', '분당 딜']);
    const rows = t.querySelectorAll('tbody tr');
    expect([...rows].map((r) => rowCells(r)[1])).toEqual(['자헨', '그웬', '카이사']);   // 최신 먼저
    const first = rows[0]!.querySelectorAll('td:not(.rn)');
    expect(first[0]!.textContent).toMatch(/\d+\. \d+\./);
    expect(first[2]!.classList.contains('lane-top')).toBe(true);
    expect(first[3]!.textContent?.trim()).toBe('패');
    expect(first[3]!.classList.contains('loss')).toBe(true);
    expect(rows[1]!.querySelectorAll('td:not(.rn)')[3]!.classList.contains('win')).toBe(true);
    expect(first[5]!.textContent?.trim()).toBe('1,239.7');
    expect(first[1]!.querySelector('img.champ')?.getAttribute('src')).toContain('/16.18.1/img/champion/Zaahen.png');
  });
  it('시간대 차트: 시각 오름차순 막대 · 값 글자 · role=img 문장', () => {
    const { container } = render(Recent, { key: 'p1', p: ME, data: DATA });
    const svg = container.querySelector('svg[role="img"]')!;
    expect(svg.getAttribute('aria-label')).toBe('시간대별 판수: 00시 1판, 22시 2판');
    expect(svg.querySelectorAll('rect.bar')).toHaveLength(2);
    expect([...svg.querySelectorAll('text.v')].map((t) => t.textContent)).toEqual(['1', '2']);
    expect([...svg.querySelectorAll('text.t')].map((t) => t.textContent)).toEqual(['00시', '22시']);
    expect(container.textContent).not.toContain('승률');
  });
});

describe('HourBars', () => {
  it('막대 높이는 최대 판수 기준, 눈금은 정수 판 단위 · 색 속성은 없다(클래스만)', () => {
    const rows = hourRows([{ hour: 21, games: 8 }, { hour: 23, games: 2 }]);
    const { container } = render(HourBars, { rows });
    const bars = [...container.querySelectorAll<SVGRectElement>('rect.bar')];
    const h = bars.map((b) => Number(b.getAttribute('height')));
    expect(h[0]).toBeGreaterThan(h[1]! * 3.5);
    expect(container.querySelectorAll('line.grid')).toHaveLength(8);   // 1판 간격 × 8
    expect(container.querySelector('svg')!.outerHTML).not.toMatch(/fill="#|stroke="#/);
    expect(container.querySelector('.cap')?.textContent).toBe('시간대별 판수');
  });
  it('많으면 2·5·10판 간격', () => {
    const { container } = render(HourBars, { rows: hourRows([{ hour: 1, games: 50 }]) });
    expect(container.querySelectorAll('line.grid')).toHaveLength(10);   // 5판 간격
  });
  it('비어 있으면 빈 상태 한 문장', () => {
    const { container } = render(HourBars, { rows: [] });
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('.empty')?.textContent).toBe('아직 시간대 기록이 없습니다.');
  });
});

describe('Partners — 파트너 · 상대 챔피언', () => {
  it('여섯 범위 캡션 · 잘 맞는 파트너는 시너지 ↓, 안 맞는 파트너는 ↑ · 시너지 부호', () => {
    const { container } = render(Partners, { key: 'p1', p: ME, data: DATA });
    const caps = [...container.querySelectorAll('.cap')].map((c) => c.textContent);
    expect(caps).toEqual(['잘 맞는 파트너', '안 맞는 파트너', '상대하기 어려운 챔피언', '상대하기 쉬운 챔피언', '내가 잡은 챔피언', '나를 잡은 챔피언']);
    const best = tableOf(container, '잘 맞는 파트너');
    expect(heads(best)).toEqual(['파트너', '함께 판', '함께 승률', '시너지']);
    expect(rowCells(best.querySelector('tbody tr')!)).toEqual(['우체국집배원', '20', '55%', '+0.043']);
    const worst = tableOf(container, '안 맞는 파트너');
    expect(rowCells(worst.querySelector('tbody tr')!)).toEqual(['외 걸', '13', '31%', '-0.065']);
    expect([...worst.querySelectorAll('thead th[scope="col"]')][3]!.getAttribute('aria-sort')).toBe('ascending');
    expect(best.querySelector('thead .qmark')?.getAttribute('aria-label')).toBe('시너지 설명');
  });
  it('챔피언 표: 한글 이름 + 초상 · 맞라인 판/승률 · 횟수 ↓', () => {
    const { container } = render(Partners, { key: 'p1', p: ME, data: DATA });
    const nem = tableOf(container, '상대하기 어려운 챔피언');
    expect(heads(nem)).toEqual(['상대 챔피언', '맞라인 판', '승률']);
    expect(rowCells(nem.querySelector('tbody tr')!)).toEqual(['아칼리', '1', '0%']);
    const vic = tableOf(container, '상대하기 쉬운 챔피언').querySelector('tbody tr')!;
    expect(rowCells(vic)).toEqual(['이즈리얼', '6', '100%']);
    expect(vic.querySelectorAll('td:not(.rn)')[2]!.classList.contains('win')).toBe(true);   // 6판 ≥ 5
    const killed = tableOf(container, '내가 잡은 챔피언');
    expect(heads(killed)).toEqual(['챔피언', '횟수']);
    expect([...killed.querySelectorAll('tbody tr')].map((r) => rowCells(r))).toEqual([['진', '15'], ['라칸', '11']]);
    expect(killed.querySelector('img.champ')).not.toBeNull();
  });
  it('파트너 행 선택 → 그 멤버 화면 · 챔피언 행은 선택 없음', async () => {
    const { container } = render(Partners, { key: 'p1', p: ME, data: DATA });
    await fireEvent.click(tableOf(container, '안 맞는 파트너').querySelector('tbody tr')!);
    expect(location.hash).toBe(`#/m/${encodeURIComponent('외 걸')}`);
    expect(tableOf(container, '내가 잡은 챔피언').querySelector('tbody tr')?.hasAttribute('tabindex')).toBe(false);
  });
});
