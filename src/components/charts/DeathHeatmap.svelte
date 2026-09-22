<script lang="ts">
  /**
   * 데스 위치 — 삽입된 차트. 소환사의 협곡 한 변을 정사각 SVG 로, 데스 한 건이 점 하나(--loss 알파).
   * 바닥 --ink, 격자·강 --grid. 색은 전부 CSS 클래스로(SVG 속성에 hex 없음). 라인 버튼 줄로 한 라인만 본다.
   *
   * 좌표는 별도 파일(data/<gid>/deaths.json)이라 **볼 때** 받는다. 신호는 둘 — 먼저 오는 쪽이 받는다:
   *  ① 눈에 들어올 때(IntersectionObserver, rootMargin 600px — 스크롤이 닿기 전에 받아 둔다)
   *  ② 이 차트가 든 하위 화면이 켜질 때(`entered`) — 창 높이가 0 인 상황(접힌 창·미리보기·임베드)에서는
   *     ①이 영영 안 온다(옛 실측). 지금 구조에서는 패널이 켜질 때 mount 되므로 ②가 먼저 오고 ①은 예비다.
   * 언마운트하면 AbortController 로 받던 것을 끊는다. 실패는 캐시되지 않으므로 '다시 시도' 가 진짜 다시 받는다.
   * 결과는 알린다 — 안 알리면 화면을 안 보는 사람에게는 아무 일도 안 일어난 것이다.
   */
  import { untrack } from 'svelte';
  import type { DeathsFile, LaneId } from '$lib/data/types';
  import { announce } from '$lib/a11y';
  import { LANE_SEQ, laneKo } from '$lib/lanes';
  import { laneBand } from '$lib/member';
  import { heatCaption, heatDot, heatPoints } from '$lib/records';
  import EmptyState from '$components/EmptyState.svelte';
  import QMark from '$components/Tooltip.svelte';

  interface Props {
    /** 표본 로더 — app.lazy.deathSample. 실패는 던진다 */
    load: (signal: AbortSignal) => Promise<DeathsFile>;
    /** 이 차트가 든 하위 화면이 켜졌는가 — 두 번째 신호 */
    entered?: boolean;
    caption?: string;
  }
  let { load, entered = false, caption = '데스 위치' }: Props = $props();

  const W = 260;
  /** 격자 눈금 — 네 칸 */
  const TICKS = [W * 0.25, W * 0.5, W * 0.75];

  type Status = 'idle' | 'loading' | 'ready' | 'error';
  let status = $state<Status>('idle');
  let file = $state.raw<DeathsFile | null>(null);
  let lane = $state<'' | LaneId>('');
  let box = $state<HTMLDivElement | undefined>();
  let ctl: AbortController | null = null;

  async function fill(): Promise<void> {
    status = 'loading';
    const c = new AbortController();
    ctl = c;
    try {
      const d = await load(c.signal);
      if (c.signal.aborted) return;
      file = d;
      status = 'ready';
      announce(`데스 ${d.points.length.toLocaleString('ko-KR')}건 표시`);
    } catch {
      if (c.signal.aborted) return;
      status = 'error';
      announce('데스 좌표를 받지 못했습니다. 다시 시도 단추를 눌러 주세요.');
    }
  }
  /** 신호(①·②)는 아직 안 받았을 때만 받기 시작한다 — 실패 뒤에 늦게 온 신호가 저절로 다시 받지 않게 */
  function onSignal(): void { if (status === 'idle') void fill(); }
  /** '다시 시도' — 실패 상태에서만 */
  function retry(): void { if (status === 'error') void fill(); }

  // ② 하위 화면 진입. onSignal 이 읽는 status 를 이 효과가 따라가면 안 된다 — untrack
  $effect(() => { if (entered) untrack(onSignal); });
  // ① 눈에 들어올 때. 구형 브라우저는 그냥 받는다
  $effect(() => {
    const el = box;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { untrack(onSignal); return; }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { io.disconnect(); onSignal(); }
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  });
  // 언마운트 — 받던 것을 끊는다
  $effect(() => () => ctl?.abort());

  const all = $derived(file?.points ?? []);
  const counts = $derived.by(() => {
    const m: Record<string, number> = {};
    for (const p of all) m[p.lane] = (m[p.lane] ?? 0) + 1;
    return m;
  });
  const pts = $derived(heatPoints(all, lane, W));
  const dot = $derived(heatDot(all.length));
  const sample = $derived(file ? heatCaption(file) : '');
  const laneText = $derived(lane ? ` · ${laneKo(lane)} ${pts.length.toLocaleString('ko-KR')}건` : '');
  const summary = $derived(`${caption} — ${sample}${laneText}. 왼쪽 아래가 블루 진영`);

  function pickLane(l: '' | LaneId) {
    if (lane === l) return;
    lane = l;
    announce(l ? `${laneKo(l)} 데스 ${pts.length}건` : `전체 데스 ${pts.length}건`);
  }
</script>

<div class="heat" bind:this={box}>
  <div class="cap">{caption} <QMark key="히트맵" label="{caption} 설명" /></div>

  {#if status === 'ready' && file}
    {#if all.length === 0}
      <EmptyState text="아직 데스 기록이 없습니다." />
    {:else}
      <div class="lanes" role="group" aria-label="라인 선택">
        <button type="button" class="vb" aria-pressed={lane === ''} onclick={() => pickLane('')}>
          전체 <span class="n">{all.length.toLocaleString('ko-KR')}</span>
        </button>
        {#each LANE_SEQ as l (l)}
          <button type="button" class="vb {laneBand(l)}" aria-pressed={lane === l} onclick={() => pickLane(l)}>
            {laneKo(l)} <span class="n">{(counts[l] ?? 0).toLocaleString('ko-KR')}</span>
          </button>
        {/each}
      </div>

      <svg class="map" viewBox="0 0 {W} {W}" role="img" aria-label={summary} style:--dot-op={dot.op}>
        <rect class="bg" x="0" y="0" width={W} height={W} />
        {#each TICKS as t (t)}
          <line class="grid" x1="0" x2={W} y1={t} y2={t} />
          <line class="grid" x1={t} x2={t} y1="0" y2={W} />
        {/each}
        <!-- 강(대각선)과 양 진영 경계 -->
        <line class="river" x1="0" y1={W} x2={W} y2="0" />
        <line class="river" x1="0" y1={W * 0.72} x2={W * 0.28} y2={W} />
        <line class="river" x1={W * 0.72} y1="0" x2={W} y2={W * 0.28} />
        {#each pts as p}
          <circle class="dot" cx={p.x} cy={p.y} r={dot.r} />
        {/each}
      </svg>
      <p class="note">{sample}{laneText} · 점 하나가 데스 한 건 · 왼쪽 아래가 블루 진영입니다.</p>
    {/if}
  {:else if status === 'error'}
    <p class="problem">
      <span>데스 좌표를 받지 못했습니다.</span>
      <button type="button" class="ctl" onclick={retry}>다시 시도</button>
    </p>
  {:else}
    <div class="skel" aria-hidden="true"></div>
    <p class="note">데스 좌표를 불러오는 중입니다.</p>
  {/if}
</div>

<style>
  .heat { display: grid; gap: var(--sp-2); min-width: 0; }
  .cap {
    display: flex;
    align-items: center;
    font-size: var(--fs-sm); font-weight: 700;
    color: var(--dim);
    padding: var(--sp-2) 0 0;
    white-space: nowrap;
  }

  /* 라인 버튼 — 라인 칩 모양(왼쪽 3px 띠)의 작은 버튼. 눌린 것은 선택색 테두리 */
  .lanes { display: flex; flex-wrap: wrap; gap: var(--sp-1); }
  .vb {
    min-height: 28px;
    padding: 0 var(--sp-2);
    background: var(--sheet);
    color: var(--dim);
    border: 1px solid var(--grid-strong);
    border-left-width: 3px;
    border-left-color: transparent;
    border-radius: var(--r-chip);
    font-size: var(--fs-sm);
    line-height: 1.6;
    white-space: nowrap;
    transition: background-color .15s ease-out, color .15s ease-out, border-color .15s ease-out;
  }
  .vb:hover { background: var(--raised); color: var(--txt); }
  .vb:active { background: var(--gutter); }
  .vb:disabled { color: var(--dim2); border-color: var(--grid); cursor: default; }
  .vb[aria-pressed='true'] { background: var(--raised); color: var(--txt); border-color: var(--sel); }
  .vb.top { border-left-color: var(--lane-top); }
  .vb.jg { border-left-color: var(--lane-jg); }
  .vb.mid { border-left-color: var(--lane-mid); }
  .vb.bot { border-left-color: var(--lane-bot); }
  .vb.sup { border-left-color: var(--lane-sup); }
  .vb .n { font-variant-numeric: tabular-nums; }

  /* 맵 — 표와 같은 1px 격자 테두리, 바닥 --ink */
  .map {
    display: block;
    width: 100%;
    max-width: 320px;
    height: auto;
    border: 1px solid var(--grid);
  }
  .bg { fill: var(--ink); }
  .grid { stroke: var(--grid); stroke-width: 1; shape-rendering: crispEdges; }
  .river { stroke: var(--grid-strong); stroke-width: 1; }
  .map { --dot-op: .5; }   /* 점 불투명도 기본 — 인라인 style:--dot-op 가 덮어쓴다 */
  .dot { fill: var(--loss); opacity: var(--dot-op); }

  .note { font-size: var(--fs-sm); color: var(--dim); text-wrap: pretty; max-width: 75ch; }

  /* 받는 중 — 맵 자리의 빈 칸(표 스켈레톤과 같은 바탕) */
  .skel {
    width: 100%;
    max-width: 320px;
    aspect-ratio: 1;
    background: var(--gutter);
    border: 1px solid var(--grid);
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse { 50% { opacity: .45; } }

  /* 실패 — 문제와 회복 수단을 한 줄에 */
  .problem { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2) var(--sp-3); color: var(--txt); }
  .ctl {
    display: inline-flex; align-items: center;
    min-height: 32px;
    padding: 0 var(--sp-3);
    background: var(--sheet);
    color: var(--txt);
    border: 1px solid var(--grid-strong);
    border-radius: var(--r-chip);
    white-space: nowrap;
    transition: background-color .15s ease-out, border-color .15s ease-out;
  }
  .ctl:hover { background: var(--raised); }
  .ctl:active { background: var(--ink); }
  .ctl:disabled { color: var(--dim2); border-color: var(--grid); cursor: default; }

  @media (pointer: coarse) {
    .vb, .ctl { min-height: 44px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .vb, .ctl { transition: none; }
    .skel { animation: none; }
  }
</style>
