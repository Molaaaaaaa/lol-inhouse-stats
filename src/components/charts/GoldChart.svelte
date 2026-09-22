<script lang="ts">
  /**
   * 골드 추이 — 경기 상세의 '삽입된 차트'. 위 판은 두 팀의 골드(선 둘), 아래 판은 골드 차이(블루 − 레드)
   * 를 0선 기준 면적으로. 선 색은 팀 색이 아니라 **결과**다: 이긴 팀 --win, 진 팀 --loss(글자로 어느 팀이
   * 어느 색인지 범례에 적는다). 격자 --grid, 0선 --grid-strong, 바닥 --ink. 색은 전부 class → CSS 토큰.
   *
   * 그라디언트 id 는 $props.id() — 경기를 둘 이상 펼치면 같은 id 가 문서에 여러 개 생기고 `url(#…)` 는
   * 처음 하나만 가리킨다(옛 파일이 난수로 피하던 문제). 폭은 래퍼 폭을 재서 글자 크기가 폰에서 안 줄어든다.
   */
  import type { MatchDetail, MatchDetailTeam } from '$lib/data/types';
  import { axisTop, goldSeries, goldSummary, goldTick, niceStep, teamLabel } from '$lib/matches';
  import EmptyState from '$components/EmptyState.svelte';

  interface Props {
    timeline: Partial<MatchDetail['timeline']> | null | undefined;
    /** 팀 둘 — 0 이 블루(a_gold), 1 이 레드(b_gold). 결과가 선 색을 정한다 */
    teams: readonly Pick<MatchDetailTeam, 'team_id' | 'win'>[];
    caption?: string;
  }
  let { timeline, teams, caption = '골드 추이' }: Props = $props();

  const gid = $props.id();
  const s = $derived(goldSeries(timeline));

  // 결과 클래스 — 둘 다 같으면(데이터 오류) 블루 --sel · 레드 --dim 로 구분만 한다
  const aWin = $derived(!!teams[0]?.win);
  const bWin = $derived(!!teams[1]?.win);
  const clsA = $derived(aWin === bWin ? 'na' : aWin ? 'win' : 'loss');
  const clsB = $derived(aWin === bWin ? 'nb' : bWin ? 'win' : 'loss');
  const labelA = $derived(teams[0] ? teamLabel(teams[0], 0) : '블루팀');
  const labelB = $derived(teams[1] ? teamLabel(teams[1], 1) : '레드팀');

  // 기하(px) — 래퍼 폭을 잰다. jsdom·초기 렌더는 0 이라 최소 폭으로
  let wrapW = $state(0);
  const W = $derived(Math.max(320, Math.floor(wrapW)));
  const L = 48, R = 12, T = 8, GAP = 26, B = 22;
  const H1 = 120, H2 = 96;
  const H = T + H1 + GAP + H2 + B;
  const iw = $derived(W - L - R);
  const y2Top = $derived(T + H1 + GAP);
  const zero = $derived(y2Top + H2 / 2);

  const X = (i: number, n: number) => L + (n <= 1 ? 0 : (iw * i) / (n - 1));

  const geo = $derived.by(() => {
    if (!s) return null;
    const n = s.minutes.length;
    // 위 판: 0 ~ 팀 골드 상한, 눈금 4개 이하
    const step1 = niceStep(s.maxGold, 4);
    const top1 = axisTop(s.maxGold, step1);
    const Y1 = (v: number) => T + H1 - (v / top1) * H1;
    // 아래 판: ±상한, 0선 가운데, 한쪽에 눈금 3개 이하
    const step2 = niceStep(s.peak, 3);
    const top2 = axisTop(s.peak, step2);
    const Y2 = (v: number) => zero - (v / top2) * (H2 / 2);
    const pt = (xs: number[], Y: (v: number) => number) => xs.map((v, i) => `${X(i, n).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const lineA = pt(s.a, Y1), lineB = pt(s.b, Y1), lineD = pt(s.diff, Y2);
    const area = `${L},${zero.toFixed(1)} ${lineD} ${(L + iw).toFixed(1)},${zero.toFixed(1)}`;
    const ticks1: { y: number; label: string }[] = [];
    for (let g = step1; g <= top1; g += step1) ticks1.push({ y: Y1(g), label: goldTick(g) });
    const ticks2: { y: number; label: string; zero: boolean }[] = [];
    for (let g = -top2; g <= top2; g += step2) ticks2.push({ y: Y2(g), label: goldTick(g, true), zero: g === 0 });
    const xs: { x: number; label: string }[] = [];
    s.minutes.forEach((m, i) => { if (m % 5 === 0) xs.push({ x: X(i, n), label: `${m}분` }); });
    const lastX = X(n - 1, n), lastY = Y2(s.last);
    return { lineA, lineB, lineD, area, ticks1, ticks2, xs, lastX, lastY };
  });

  const leadCls = $derived(!s ? '' : s.last >= 0 ? clsA : clsB);
  const summary = $derived(s ? goldSummary(s) : '');
</script>

<div class="gold" bind:clientWidth={wrapW}>
  <div class="cap">{caption}</div>
  {#if !s || !geo}
    <EmptyState text="아직 골드 기록이 없습니다." />
  {:else}
    <div class="legend" aria-hidden="true">
      <span class="key"><i class="sw {clsA}"></i>{labelA} · {aWin ? '승' : '패'}</span>
      <span class="key"><i class="sw {clsB}"></i>{labelB} · {bWin ? '승' : '패'}</span>
      <span class="muted">아래 판 · 골드 차이 = 블루 − 레드</span>
    </div>
    <svg width={W} height={H} viewBox="0 0 {W} {H}" role="img" aria-label="{caption}: {summary}">
      <rect class="bg" x="0" y="0" width={W} height={H} />
      <!-- 위 판: 팀 골드 -->
      {#each geo.ticks1 as t (t.label)}
        <line class="grid" x1={L} x2={L + iw} y1={t.y.toFixed(1)} y2={t.y.toFixed(1)} />
        <text class="tk" x={L - 6} y={(t.y + 3.5).toFixed(1)} text-anchor="end">{t.label}</text>
      {/each}
      <line class="axis" x1={L} x2={L + iw} y1={T + H1} y2={T + H1} />
      <polyline class="line ta {clsA}" points={geo.lineA} />
      <polyline class="line tb {clsB}" points={geo.lineB} />
      <!-- 아래 판: 골드 차이 -->
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" class="stop {clsA} deep" />
          <stop offset="50%" class="stop {clsA} thin" />
          <stop offset="50%" class="stop {clsB} thin" />
          <stop offset="100%" class="stop {clsB} deep" />
        </linearGradient>
      </defs>
      {#each geo.ticks2 as t (t.label)}
        <line class={t.zero ? 'axis' : 'grid'} x1={L} x2={L + iw} y1={t.y.toFixed(1)} y2={t.y.toFixed(1)} />
        <text class="tk" x={L - 6} y={(t.y + 3.5).toFixed(1)} text-anchor="end">{t.label}</text>
      {/each}
      <polygon class="area" points={geo.area} fill="url(#{gid})" />
      <polyline class="line diff" points={geo.lineD} />
      <circle class="last {leadCls}" cx={geo.lastX.toFixed(1)} cy={geo.lastY.toFixed(1)} r="3.5" />
      <!-- x축: 5분 간격 -->
      {#each geo.xs as x (x.label)}
        <line class="grid v" x1={x.x.toFixed(1)} x2={x.x.toFixed(1)} y1={T} y2={y2Top + H2} />
        <text class="tk" x={x.x.toFixed(1)} y={H - 7} text-anchor="middle">{x.label}</text>
      {/each}
    </svg>
    <p class="foot">{summary}</p>
  {/if}
</div>

<style>
  .gold { width: 100%; min-width: 0; }
  .cap {
    font-size: var(--fs-sm); font-weight: 700;
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1) var(--sp-3);
    padding: 0 0 var(--sp-1);
    font-size: var(--fs-sm);
  }
  .key { display: inline-flex; align-items: center; gap: var(--sp-1); }
  .sw { display: inline-block; width: 14px; height: 3px; background: var(--dim); }
  .sw.win { background: var(--win); }
  .sw.loss { background: var(--loss); }
  .sw.na { background: var(--sel); }
  .sw.nb { background: var(--dim); }

  svg { display: block; border: 1px solid var(--grid); font-family: var(--font); font-variant-numeric: tabular-nums; }
  .bg { fill: var(--ink); }
  .grid { stroke: var(--grid); stroke-width: 1; shape-rendering: crispEdges; }
  .grid.v { stroke-dasharray: 2 4; }
  .axis { stroke: var(--grid-strong); stroke-width: 1; shape-rendering: crispEdges; }
  .tk { fill: var(--dim2); font-size: var(--fs-tick); }
  .line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; stroke: var(--dim); }
  .line.win { stroke: var(--win); }
  .line.loss { stroke: var(--loss); }
  .line.na { stroke: var(--sel); }
  .line.nb { stroke: var(--dim); }
  .line.diff { stroke: var(--txt); stroke-width: 1.5; }
  .stop { stop-color: var(--dim); }
  .stop.win { stop-color: var(--win); }
  .stop.loss { stop-color: var(--loss); }
  .stop.na { stop-color: var(--sel); }
  .stop.nb { stop-color: var(--dim); }
  .stop.deep { stop-opacity: .3; }
  .stop.thin { stop-opacity: .05; }
  .last { fill: var(--dim); stroke: var(--ink); stroke-width: 1; }
  .last.win { fill: var(--win); }
  .last.loss { fill: var(--loss); }
  .last.na { fill: var(--sel); }
  .foot { padding: var(--sp-1) 0 0; font-size: var(--fs-sm); color: var(--dim); }
</style>
