<script lang="ts">
  /**
   * 멤버 · 요약 — 이름 있는 범위 넷: 라인 분포(한 행짜리 누적 막대) · 라인별 MMR 표 · 능력치(육각형 + 축 표 + 솔랭 기준선) ·
   * 챔피언 표. 표는 전부 DataTable, 차트는 삽입된 차트(charts/*). 문턱·눈금·컷은 payload 에서만 읽는다.
   *
   * 능력치 라인: profile_lane 의 라인이 둘 이상일 때만 선택 줄을 낸다. 기본은 주 라인(옛 curAxisLane 규칙).
   * 이 컴포넌트는 멤버가 바뀌면 호출부가 {#key} 로 새로 만든다 — 라인 선택·표 거르기가 그 사람 것이다.
   */
  import type { GuildPayload, LaneId, PlayerChampion, PlayerPub } from '$lib/data/types';
  import type { Col } from '$lib/table';
  import { pct, sgn, fmtMetric } from '$lib/fmt';
  import { laneKo } from '$lib/lanes';
  import { mLabel } from '$lib/metrics';
  import { baselinePanel, NO_BASELINE } from '$lib/baseline';
  import { axisLaneFor, axisLanes, axisRows, laneCls, laneRows, wrCls, type LaneRow } from '$lib/member';
  import DataTable from '$components/DataTable.svelte';
  import QMark from '$components/Tooltip.svelte';
  import LaneBar from '$components/charts/LaneBar.svelte';
  import Radar from '$components/charts/Radar.svelte';
  import AxisBars from '$components/charts/AxisBars.svelte';

  interface Props { key: string; p: PlayerPub; data: GuildPayload }
  let { key, p, data }: Props = $props();

  const meta = $derived(data.metric_meta);
  const minGames = $derived(data.min_games || 5);
  const minGamesLane = $derived(data.min_games_lane || 3);
  const mainLane = $derived(data.cp?.[key]?.main_lane ?? data.ratings?.[key]?.main_lane ?? '');

  // ── 라인별 MMR 표 ──
  const lanes = $derived(laneRows(data, key));
  const laneCols = $derived<Col<LaneRow>[]>([
    { k: 'lane', h: '라인', fmt: (v) => laneKo(String(v)), cls: (r) => laneCls(r.lane) },
    { k: 'games', h: '판', num: true },
    { k: 'mmr', h: 'MMR', num: true, hlp: '라인MMR', fmt: (v) => (v == null ? '-' : String(v)), cls: (r) => (r.placed ? '' : 'pend') },
    { k: 'dev', h: '편차', num: true, fmt: (v) => (v == null ? '-' : sgn(Number(v), 1)) },
    { k: 'placement', h: '배치', sortable: false, cls: (r) => (r.placed ? '' : 'pend') },
    { k: 'winrate', h: mLabel(meta, 'winrate'), num: true, fmt: (v) => (v == null ? '-' : pct(Number(v))), cls: (r) => wrCls(r.winrate, r.games, minGamesLane) },
    { k: 'kda', h: mLabel(meta, 'kda'), num: true, lo: true, fmt: (v) => (v == null ? '-' : String(v)) },
    { k: 'dpm', h: mLabel(meta, 'dpm'), num: true, lo: true, fmt: (v) => (v == null ? '-' : Math.round(Number(v)).toLocaleString('ko-KR')) },
    { k: 'kp', h: mLabel(meta, 'kp'), num: true, lo: true, fmt: (v) => (v == null ? '-' : pct(Number(v))) },
  ]);

  // ── 능력치 ──
  const axLanes = $derived(axisLanes(p));
  let picked = $state<string | null>(null);
  const curLane = $derived(axisLaneFor(picked, axLanes, mainLane));
  const axes = $derived(axisRows(p, curLane));
  const scale = $derived(data.profile_scale);
  const laneNote = $derived(
    curLane
      ? `${laneKo(curLane)}에서 뛴 판만, ${laneKo(curLane)}끼리 비교 · 평균 ${scale?.room_avg ?? '-'}`
      : `전체 판, 방 전체 기준 · 평균 ${scale?.room_avg ?? '-'}`,
  );

  // ── 솔랭 기준선 ──
  interface BRow { id: string; axis: string; metric: string; value: string; top: number | null; pos: string; cls: string; games: number | null }
  const panel = $derived(baselinePanel(data, p, key, (curLane || '') as LaneId | ''));
  const bRows = $derived.by((): BRow[] => {
    if (!panel) return [];
    const out: BRow[] = [];
    for (const row of panel.rows) {
      if (!row.cells.length) {
        out.push({ id: row.label, axis: row.label, metric: NO_BASELINE, value: '', top: null, pos: '', cls: '', games: row.games });
        continue;
      }
      for (const c of row.cells) {
        out.push({
          id: `${row.label}:${c.key}`, axis: row.label, metric: c.metricLabel,
          value: fmtMetric(c.key, c.value, meta), top: c.pos.top, pos: c.pos.label,
          cls: c.pos.cls === 'good' ? 'win' : c.pos.cls === 'bad' ? 'loss' : '', games: row.games,
        });
      }
    }
    return out;
  });
  const bCols: Col<BRow>[] = [
    { k: 'axis', h: '축' },
    { k: 'metric', h: '지표' },
    { k: 'value', h: '내전 값', num: true, sortable: false },
    { k: 'top', h: '솔랭 기준', hlp: '기준선', fmt: (_v, r) => r.pos, cls: (r) => r.cls, nullLast: true },
    { k: 'games', h: '판', num: true, lo: true, fmt: (v) => (v == null ? '' : String(v)) },
  ];

  // ── 챔피언 ──
  const champs = $derived(p.champions ?? []);
  const champCols = $derived<Col<PlayerChampion>[]>([
    { k: 'champion_name', h: '챔피언', img: (r) => r.champion_name, fmt: (v) => data.champ_ko?.[String(v)] ?? String(v) },
    { k: 'lane', h: '라인', fmt: (v) => laneKo(String(v)), cls: (r) => laneCls(r.lane) },
    { k: 'games', h: '판', num: true },
    { k: 'winrate', h: mLabel(meta, 'winrate'), num: true, fmt: (v) => pct(Number(v)), cls: (r) => wrCls(r.winrate, r.games, minGames) },
    { k: 'kda', h: mLabel(meta, 'kda'), num: true },
  ]);
</script>

<div class="summary">
  <div class="two">
    <div class="range">
      <div class="cap">라인 분포</div>
      <LaneBar dist={p.role_dist ?? []} />
    </div>
    <DataTable rows={lanes} cols={laneCols} caption="라인별 MMR" sortKey="games" rowKey={(r) => String(r.lane)} />
  </div>

  <div class="range">
    <div class="cap">
      <span>능력치</span>
      <QMark key="능력치" payload={data} label="능력치 설명" />
      {#if axLanes.length >= 2}
        <div class="lp" role="group" aria-label="능력치 라인 선택">
          <button type="button" aria-pressed={curLane === ''} onclick={() => { picked = ''; }}>전체</button>
          {#each axLanes as L (L)}
            <button type="button" aria-pressed={curLane === L} onclick={() => { picked = L; }}>{laneKo(L)}</button>
          {/each}
        </div>
      {/if}
    </div>
    <p class="note">{laneNote}</p>
    <div class="stat">
      <Radar {axes} {scale} {minGames} />
      <AxisBars {axes} {scale} {minGames} {meta} caption="능력치 축" />
    </div>
    {#if panel}
      <DataTable rows={bRows} cols={bCols} caption="솔랭 기준선 · {laneKo(panel.lane)} · {panel.sample}"
                 rowKey={(r) => r.id} lowerBetterKeys={['top']} fold={false} filter={false} />
    {/if}
  </div>

  <DataTable rows={champs} cols={champCols} caption="챔피언" sortKey="games" rowKey={(r) => `${r.champion_name}|${r.lane}`} />
</div>

<style>
  .summary { display: grid; gap: var(--sp-5); }
  /* 라인 분포 막대는 격자 한 행 — 라인별 MMR 표 위에 같은 폭으로 놓인다(옆에 두던 도넛 자리) */
  .two { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-4); align-items: start; }
  .range { min-width: 0; }
  .cap {
    display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-2) var(--sp-3);
    font-size: var(--fs-xs); color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
  }
  .note { font-size: var(--fs-sm); color: var(--dim); padding-bottom: var(--sp-2); }

  /* 라인 선택 — 셀 한 줄. 누른 것은 시트 바탕 + 아래 2px 선택선(시트 탭과 같은 어휘) */
  .lp { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--grid); }
  .lp button {
    min-height: 28px;
    padding: 0 var(--sp-3);
    border: 0;
    border-right: 1px solid var(--grid);
    border-bottom: 2px solid transparent;
    background: var(--gutter);
    color: var(--dim);
    font-size: var(--fs-sm);
    transition: background-color .15s, color .15s, border-color .15s;
  }
  .lp button:last-child { border-right: 0; }
  .lp button:hover { background: var(--raised); color: var(--txt); }
  .lp button:active { background: var(--ink); }
  .lp button[aria-pressed='true'] { background: var(--sheet); color: var(--txt); border-bottom-color: var(--sel); }
  .lp button:disabled { color: var(--dim2); cursor: default; }

  .stat { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-4); align-items: start; }
  @media (min-width: 760px) {
    .stat { grid-template-columns: 250px minmax(0, 1fr); }
  }
  @media (pointer: coarse) {
    .lp button { min-height: 44px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .lp button { transition: none; }
  }
</style>
