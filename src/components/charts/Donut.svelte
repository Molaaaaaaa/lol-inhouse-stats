<script lang="ts">
  /**
   * 라인 분포 도넛 — 삽입된 차트. 조각은 라인 띠 색(class → --lane-*), 가운데는 총 판수, 옆 범례는
   * 라인 이름·판수 글자(색만으로 구분하지 않는다). SVG 속성에 hex 없음.
   *
   * 한 라인만 뛴 사람은 호의 시작점과 끝점이 같아져 path 가 통째로 사라진다(옛 실측: 16명 중 11명이
   * 빈 칸을 봤다) → 조각이 하나면 원(circle)으로 링을 그린다.
   */
  import type { LaneId } from '$lib/data/types';
  import { laneKo } from '$lib/lanes';
  import { laneBand } from '$lib/member';

  interface Props {
    dist: readonly { lane: LaneId | string; games: number; pct?: number }[];
    label?: string;
  }
  let { dist, label = '라인 분포' }: Props = $props();

  const R = 46, r = 27, C = 54;
  const band = (l: string) => laneBand(l) || 'none';

  const rows = $derived(dist.filter((x) => (Number(x.games) || 0) > 0));
  const total = $derived(rows.reduce((t, x) => t + (Number(x.games) || 0), 0));

  interface Seg { lane: string; games: number; d: string }
  const segs = $derived.by((): Seg[] => {
    if (rows.length < 2 || total <= 0) return [];
    let a0 = -Math.PI / 2;
    return rows.map((x) => {
      const frac = x.games / total;
      const a1 = a0 + frac * 2 * Math.PI;
      const L = frac > 0.5 ? 1 : 0;
      const f = (v: number) => v.toFixed(1);
      const d = `M${f(C + R * Math.cos(a0))} ${f(C + R * Math.sin(a0))} A${R} ${R} 0 ${L} 1 ${f(C + R * Math.cos(a1))} ${f(C + R * Math.sin(a1))}`
        + ` L${f(C + r * Math.cos(a1))} ${f(C + r * Math.sin(a1))} A${r} ${r} 0 ${L} 0 ${f(C + r * Math.cos(a0))} ${f(C + r * Math.sin(a0))} Z`;
      a0 = a1;
      return { lane: x.lane, games: x.games, d };
    });
  });
  const summary = $derived(rows.map((x) => `${laneKo(x.lane)} ${x.games}판`).join(', '));
</script>

{#if rows.length === 0}
  <p class="empty">아직 출전 기록이 없습니다.</p>
{:else}
  <div class="donut">
    <svg viewBox="0 0 108 108" role="img" aria-label="{label}: {summary}">
      {#if segs.length === 0}
        <circle class="seg {band(rows[0]!.lane)}" cx={C} cy={C} r={(R + r) / 2} stroke-width={R - r} />
      {:else}
        {#each segs as s (s.lane)}
          <path class="seg {band(s.lane)}" d={s.d} />
        {/each}
      {/if}
      <text class="tot" x={C} y={C + 1} text-anchor="middle" dominant-baseline="middle">{total}</text>
    </svg>
    <ul class="legend">
      {#each rows as x (x.lane)}
        <li class={band(x.lane)}>
          <span class="name">{laneKo(x.lane)}</span>
          <span class="n">{x.games}판</span>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .donut { display: flex; align-items: center; gap: var(--sp-4); }
  svg {
    flex: none;
    width: 108px;
    height: 108px;
    background: var(--ink);
    border: 1px solid var(--grid);
  }
  /* 조각: 라인 띠 토큰. circle 은 stroke 로, path 는 fill 로 같은 색 */
  path.seg { stroke: var(--ink); stroke-width: 1; }
  circle.seg { fill: none; }
  path.top { fill: var(--lane-top); } circle.top { stroke: var(--lane-top); }
  path.jg { fill: var(--lane-jg); } circle.jg { stroke: var(--lane-jg); }
  path.mid { fill: var(--lane-mid); } circle.mid { stroke: var(--lane-mid); }
  path.bot { fill: var(--lane-bot); } circle.bot { stroke: var(--lane-bot); }
  path.sup { fill: var(--lane-sup); } circle.sup { stroke: var(--lane-sup); }
  path.none { fill: var(--grid-strong); } circle.none { stroke: var(--grid-strong); }
  .tot { fill: var(--txt); font-size: var(--fs-num); font-weight: 700; font-variant-numeric: tabular-nums; }

  .legend { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--sp-1); }
  .legend li {
    display: flex; align-items: center; gap: var(--sp-2);
    padding-left: var(--sp-2);
    border-left: 3px solid transparent;
    line-height: 1.6;
  }
  li.top { border-left-color: var(--lane-top); }
  li.jg { border-left-color: var(--lane-jg); }
  li.mid { border-left-color: var(--lane-mid); }
  li.bot { border-left-color: var(--lane-bot); }
  li.sup { border-left-color: var(--lane-sup); }
  .n { color: var(--dim); font-variant-numeric: tabular-nums; }
  .empty { margin: 0; padding: var(--sp-3); border: 1px solid var(--grid); color: var(--dim); }
</style>
