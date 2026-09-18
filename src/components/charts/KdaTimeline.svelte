<script lang="ts">
  /**
   * 킬 · 데스 · 어시 타임라인 — 경기 시간 위에 사건을 점으로. 세 줄(킬 --win · 어시 --dim · 데스 --loss),
   * 5분 격자 --grid, 바닥 --ink. 점마다 <title>(분 · 종류 · 상대 챔피언). 같은 구간에 몰린 점은 살짝 흔들어 놓는다
   * (한타에서 어시가 몰린다). 폭은 래퍼 폭을 재고 글자 크기는 토큰 그대로.
   * 누적 그래프보다 이게 낫다: "몇 분에 누구를 잡았나" 가 바로 읽히고, 점이 몰린 구간이 한타였다는 것도 보인다.
   */
  import type { ChampKo } from '$lib/matches';
  import { KDA_KO, kdaCounts, kdaMarks } from '$lib/matches';

  interface Props {
    events: readonly { s: number; t: string; vs?: string }[] | null | undefined;
    /** 경기 길이(초) */
    duration: number;
    champKo?: ChampKo;
    /** aria 문장의 주어 */
    name?: string;
    caption?: string;
  }
  let { events, duration, champKo = null, name = '멤버', caption = '킬 · 데스 · 어시 타임라인' }: Props = $props();

  const marks = $derived(kdaMarks(events, duration, champKo));
  const counts = $derived(kdaCounts(marks));

  let wrapW = $state(0);
  const W = $derived(Math.max(240, Math.floor(wrapW)));
  const L = 10, R = 10, H = 66;
  const ROW: Record<'K' | 'A' | 'D', number> = { K: 14, A: 30, D: 46 };
  const X = (t: number) => L + (W - L - R) * t;
  const ticks = $derived.by(() => {
    const out: { x: number; label: string }[] = [];
    const dur = Math.max(1, duration);
    for (let m = 0; m * 60 <= dur; m += 5) out.push({ x: X(m * 60 / dur), label: `${m}분` });
    return out;
  });
  // 겹친 점은 ±2.5 로 번갈아 흔든다
  const jitter = (n: number) => (n % 2 ? 2.5 : 0) * (n % 4 < 2 ? 1 : -1);
  const summary = $derived(`${name} 킬 ${counts.K} 데스 ${counts.D} 어시 ${counts.A}`);
</script>

<div class="kdatl" bind:clientWidth={wrapW}>
  <div class="cap">{caption}</div>
  {#if marks.length === 0}
    <p class="muted none">이 판에는 킬 · 데스 · 어시 기록이 없습니다.</p>
  {:else}
    <div class="legend" aria-hidden="true">
      <span class="key"><i class="sw k"></i>{KDA_KO.K} {counts.K}</span>
      <span class="key"><i class="sw d"></i>{KDA_KO.D} {counts.D}</span>
      <span class="key"><i class="sw a"></i>{KDA_KO.A} {counts.A}</span>
    </div>
    <svg width={W} height={H} viewBox="0 0 {W} {H}" role="img" aria-label="{caption}: {summary}">
      <rect class="bg" x="0" y="0" width={W} height={H} />
      {#each ticks as t (t.label)}
        <line class="grid" x1={t.x.toFixed(1)} x2={t.x.toFixed(1)} y1="6" y2="52" />
        <text class="tk" x={t.x.toFixed(1)} y={H - 4} text-anchor="middle">{t.label}</text>
      {/each}
      {#each [ROW.K, ROW.A, ROW.D] as y (y)}
        <line class="row" x1={L} x2={W - R} y1={y} y2={y} />
      {/each}
      {#each marks as m (m.i)}
        <circle class="mark {m.kind.toLowerCase()}" cx={X(m.t).toFixed(1)} cy={(ROW[m.kind] + jitter(m.stack)).toFixed(1)} r="3.6">
          <title>{m.label}</title>
        </circle>
      {/each}
    </svg>
  {/if}
</div>

<style>
  .kdatl { width: 100%; min-width: 0; }
  .cap {
    font-size: var(--fs-xs);
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  .none { font-size: var(--fs-sm); }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1) var(--sp-3);
    padding: 0 0 var(--sp-1);
    font-size: var(--fs-sm);
  }
  .key { display: inline-flex; align-items: center; gap: var(--sp-1); }
  .sw { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
  .sw.k { background: var(--win); }
  .sw.d { background: var(--loss); }
  .sw.a { background: var(--dim); }
  svg { display: block; border: 1px solid var(--grid); font-family: var(--font); font-variant-numeric: tabular-nums; }
  .bg { fill: var(--ink); }
  .grid { stroke: var(--grid); stroke-width: 1; shape-rendering: crispEdges; }
  .row { stroke: var(--grid); stroke-width: 1; stroke-dasharray: 1 3; }
  .tk { fill: var(--dim2); font-size: var(--fs-xs); }
  .mark { stroke: var(--ink); stroke-width: 1; }
  .mark.k { fill: var(--win); }
  .mark.d { fill: var(--loss); }
  .mark.a { fill: var(--dim); }
</style>
