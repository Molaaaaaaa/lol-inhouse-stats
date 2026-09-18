<script lang="ts">
  /**
   * 시간대별 판수 — 표 아래 '삽입된 차트'. 시각마다 막대 하나, 값은 막대 위 글자, 시각은 아래 라벨.
   * 바닥은 --ink, 눈금선은 --grid(1판 단위, 많으면 2·5·10판), 막대는 --sel. 색은 전부 CSS 클래스로
   * (SVG 속성에 색 없음). 폭은 시각 수에 비례하고 넘치면 가로 스크롤 — 표와 같은 규칙.
   *
   * 승률은 싣지 않는다(hourRows 참고). 보조기술에는 role=img + 시각별 판수를 문장으로 읽힌다.
   */
  import EmptyState from '$components/EmptyState.svelte';
  import type { HourRow } from '$lib/member-rest';

  interface Props {
    /** hourRows() 결과 — 시각 오름차순, 판수 > 0 */
    rows: readonly HourRow[];
    caption?: string;
  }
  let { rows, caption = '시간대별 판수' }: Props = $props();

  // 기하(px). 행 높이 36 을 눈금 단위로 삼는다 — 막대 최대 높이 = 세 행 분량
  const COL = 40;
  const BAR = 24;
  const TOP = 20;     // 값 글자 자리
  const PLOT = 108;   // 막대 최대 높이
  const AXIS = 22;    // 시각 라벨 자리
  const H = TOP + PLOT + AXIS;
  const BASE = TOP + PLOT;

  const W = $derived(Math.max(1, rows.length) * COL);
  const max = $derived(rows.reduce((m, r) => Math.max(m, r.games), 0) || 1);
  /** 눈금 간격 — 선이 12개를 넘지 않게 1·2·5·10… 판 단위 */
  const step = $derived.by((): number => {
    for (let mag = 1; ; mag *= 10) for (const n of [1, 2, 5]) if (max / (n * mag) <= 12) return n * mag;
  });
  const ticks = $derived.by(() => {
    const t: number[] = [];
    for (let g = step; g <= max; g += step) t.push(BASE - (g / max) * PLOT);
    return t;
  });
  const bars = $derived(rows.map((r, i) => {
    const h = Math.max(2, Math.round((r.games / max) * PLOT));
    return { ...r, x: i * COL + (COL - BAR) / 2, y: BASE - h, h, cx: i * COL + COL / 2 };
  }));
  const summary = $derived(rows.map((r) => `${r.label} ${r.games}판`).join(', '));
</script>

<div class="hourbars">
  <div class="cap">{caption}</div>
  {#if rows.length === 0}
    <EmptyState text="아직 시간대 기록이 없습니다." />
  {:else}
    <div class="scroll">
      <svg width={W} height={H} viewBox="0 0 {W} {H}" role="img" aria-label="{caption}: {summary}">
        <rect class="bg" x="0" y="0" width={W} height={H} />
        {#each ticks as y (y)}
          <line class="grid" x1="0" x2={W} y1={y} y2={y} />
        {/each}
        {#each bars as b (b.hour)}
          <rect class="bar" x={b.x} y={b.y} width={BAR} height={b.h} />
          <text class="v" x={b.cx} y={b.y - 4} text-anchor="middle">{b.games}</text>
          <text class="t" x={b.cx} y={H - 7} text-anchor="middle">{b.label}</text>
        {/each}
        <line class="axis" x1="0" x2={W} y1={BASE} y2={BASE} />
      </svg>
    </div>
  {/if}
</div>

<style>
  .hourbars { width: 100%; }
  .cap {
    font-size: var(--fs-xs);
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  .scroll { overflow-x: auto; border: 1px solid var(--grid); }
  svg { display: block; font-family: var(--font); font-variant-numeric: tabular-nums; }
  .bg { fill: var(--ink); }
  .grid { stroke: var(--grid); stroke-width: 1; shape-rendering: crispEdges; }
  .axis { stroke: var(--grid-strong); stroke-width: 1; shape-rendering: crispEdges; }
  .bar { fill: var(--sel); }
  .v { fill: var(--txt); font-size: var(--fs-xs); }
  .t { fill: var(--dim); font-size: var(--fs-xs); }
</style>
