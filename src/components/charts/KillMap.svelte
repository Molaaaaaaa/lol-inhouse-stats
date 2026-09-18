<script lang="ts">
  /**
   * 킬 지도 — 어디서 싸움이 났고 누가 죽었는지. 좌표는 0~1(맵 한 변 16000 기준), 왼쪽 아래가 블루 진영.
   * 바닥 --ink, 격자 --grid(4등분) + 대각선(강), 점 색은 **잡은 팀의 결과**(--win · --loss), 처형은 --dim2 사각형.
   * 점마다 <title>(분 · 잡은 이 → 잡힌 이)로 hover 툴팁, 같은 문구가 아래 표(호출부)에도 실린다.
   * 색은 전부 class → CSS 토큰. viewBox 0~100 이고 폭은 CSS 로(정사각형).
   */
  import type { KillDot } from '$lib/matches';
  import EmptyState from '$components/EmptyState.svelte';

  interface Props {
    dots: readonly KillDot[];
    caption?: string;
    /** 강조할 점(표에서 선택한 킬의 i). 없으면 -1 */
    selected?: number;
  }
  let { dots, caption = '킬 지도', selected = -1 }: Props = $props();

  const S = 100;
  // 라이엇 좌표는 y 가 위로 자란다 → 아래 기준으로 뒤집는다
  const cx = (d: KillDot) => (d.x * S).toFixed(1);
  const cy = (d: KillDot) => ((1 - d.y) * S).toFixed(1);
  const counts = $derived({
    win: dots.filter((d) => d.cls === 'win').length,
    loss: dots.filter((d) => d.cls === 'loss').length,
    exec: dots.filter((d) => d.cls === 'exec').length,
  });
  const summary = $derived(`${dots.length}킬 · 이긴 팀 ${counts.win} · 진 팀 ${counts.loss} · 처형 ${counts.exec}`);
</script>

<div class="killmap">
  <div class="cap">{caption}</div>
  {#if dots.length === 0}
    <EmptyState text="아직 킬 기록이 없습니다." />
  {:else}
    <svg viewBox="0 0 {S} {S}" role="img" aria-label="{caption}: {summary}">
      <rect class="bg" x="0" y="0" width={S} height={S} />
      {#each [25, 50, 75] as g (g)}
        <line class="grid" x1={g} x2={g} y1="0" y2={S} />
        <line class="grid" x1="0" x2={S} y1={g} y2={g} />
      {/each}
      <line class="river" x1="0" y1={S} x2={S} y2="0" />
      {#each dots as d (d.i)}
        {#if d.cls === 'exec'}
          <rect class="dot exec" class:on={d.i === selected} x={(Number(cx(d)) - 1.4).toFixed(1)} y={(Number(cy(d)) - 1.4).toFixed(1)} width="2.8" height="2.8">
            <title>{d.label}</title>
          </rect>
        {:else}
          <circle class="dot {d.cls}" class:on={d.i === selected} cx={cx(d)} cy={cy(d)} r="1.6">
            <title>{d.label}</title>
          </circle>
        {/if}
      {/each}
    </svg>
    <div class="legend">
      <span class="key"><i class="sw win"></i>이긴 팀이 잡음 {counts.win}</span>
      <span class="key"><i class="sw loss"></i>진 팀이 잡음 {counts.loss}</span>
      <span class="key"><i class="sw exec"></i>처형(포탑 · 미니언) {counts.exec}</span>
      <span class="muted">{dots.length}킬 · 왼쪽 아래가 블루 진영</span>
    </div>
  {/if}
</div>

<style>
  .killmap { width: 100%; min-width: 0; }
  .cap {
    font-size: var(--fs-xs);
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  svg {
    display: block;
    width: 100%;
    max-width: 420px;
    aspect-ratio: 1;
    height: auto;
    border: 1px solid var(--grid);
  }
  .bg { fill: var(--ink); }
  .grid { stroke: var(--grid); stroke-width: .4; }
  .river { stroke: var(--grid-strong); stroke-width: .4; stroke-dasharray: 1.5 1.5; }
  .dot { stroke: var(--ink); stroke-width: .4; }
  .dot.win { fill: var(--win); }
  .dot.loss { fill: var(--loss); }
  .dot.exec { fill: var(--dim2); }
  .dot.on { stroke: var(--sel); stroke-width: .8; }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1) var(--sp-3);
    padding: var(--sp-1) 0 0;
    font-size: var(--fs-sm);
  }
  .key { display: inline-flex; align-items: center; gap: var(--sp-1); }
  .sw { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
  .sw.win { background: var(--win); }
  .sw.loss { background: var(--loss); }
  .sw.exec { background: var(--dim2); border-radius: 0; }
</style>
