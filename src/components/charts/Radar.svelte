<script lang="ts">
  /**
   * 능력치 육각형 — 삽입된 차트. 눈금 링(--grid)·축선·방 평균선(점선)·채움 다각형(--sel 22%)·
   * 꼭짓점 라벨(축 이름 + 점수). 색은 전부 class → CSS 토큰이다(SVG 속성에 hex 없음).
   *
   * 축은 3개 이상일 때만 그린다. 그 아래면 '판수가 부족해 능력치를 표시할 수 없습니다.'
   * 정확한 값·순위는 옆의 AxisBars 표가 글자로 담당하므로 이 그림은 role=img 한 문장으로 요약한다.
   */
  import type { GuildPayload, ProfileAxis } from '$lib/data/types';
  import { axisDigits } from '$lib/member';

  interface Props {
    axes: readonly ProfileAxis[];
    scale: Pick<GuildPayload['profile_scale'], 'max' | 'rings' | 'room_avg' | 'step'> | null | undefined;
    /** 이 판수 미만인 축은 라벨을 옅게(--dim2) */
    minGames?: number;
    label?: string;
  }
  let { axes, scale, minGames = 0, label = '능력치 육각형' }: Props = $props();

  const W = 236, H = 232, CX = 118, CY = 112, R = 70;
  const MAX = $derived(scale?.max || 5);
  const RINGS = $derived(Math.max(1, Math.round(scale?.rings || 5)));
  const AVG = $derived((scale?.room_avg ?? 2.75) / MAX);
  const digits = $derived(axisDigits(scale?.step));

  const N = $derived(axes.length);

  /** i 번째 축의 반지름 비율 f 지점 — 위(-90°)에서 시계 방향 */
  function pt(i: number, f: number): [number, number] {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return [CX + R * f * Math.cos(a), CY + R * f * Math.sin(a)];
  }
  const poly = (f: number) => Array.from({ length: N }, (_, i) => pt(i, f).map((v) => v.toFixed(1)).join(',')).join(' ');
  const ringFs = $derived(Array.from({ length: RINGS }, (_, r) => (r + 1) / RINGS));
  // 0점도 중심에 붙지 않게 최소 4% — 도형이 점으로 사라지면 축이 없는 것과 구분이 안 된다
  const areaPts = $derived(axes.map((a, i) => pt(i, Math.max(0.04, a.score / MAX))));
  const area = $derived(areaPts.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' '));
  const summary = $derived(axes.map((a) => `${a.label} ${a.score.toFixed(digits)}`).join(', '));
</script>

{#if N < 3}
  <p class="empty">판수가 부족해 능력치를 표시할 수 없습니다.</p>
{:else}
  <svg class="radar" viewBox="0 0 {W} {H}" role="img" aria-label="{label}: {summary}">
    {#each ringFs as f (f)}
      <polygon class="ring" points={poly(f)} />
    {/each}
    {#each axes as _, i (i)}
      {@const q = pt(i, 1)}
      <line class="spoke" x1={CX} y1={CY} x2={q[0].toFixed(1)} y2={q[1].toFixed(1)} />
    {/each}
    <polygon class="avg" points={poly(AVG)} />
    <polygon class="area" points={area} />
    {#each areaPts as q, i (i)}
      <circle class="dot" cx={q[0].toFixed(1)} cy={q[1].toFixed(1)} r="3" />
    {/each}
    {#each axes as a, i (a.key)}
      {@const q = pt(i, 1.3)}
      {@const thin = minGames > 0 && a.games != null && a.games < minGames}
      <text class={['lbl', thin && 'thin']} x={q[0].toFixed(1)} y={(q[1] - 2).toFixed(1)} text-anchor="middle">{a.label}</text>
      <text class="val" x={q[0].toFixed(1)} y={(q[1] + 11).toFixed(1)} text-anchor="middle">{a.score.toFixed(digits)}</text>
    {/each}
  </svg>
{/if}

<style>
  .radar {
    display: block;
    width: 100%;
    max-width: 250px;
    height: auto;
    background: var(--ink);
    border: 1px solid var(--grid);
  }
  .ring { fill: none; stroke: var(--grid); stroke-width: 1; }
  .spoke { stroke: var(--grid); stroke-width: 1; }
  .avg { fill: none; stroke: var(--grid-strong); stroke-width: 1; stroke-dasharray: 3 3; }
  .area {
    fill: color-mix(in srgb, var(--sel) 22%, transparent);
    stroke: var(--sel);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .dot { fill: var(--sel); }
  .lbl { font-size: var(--fs-xs); fill: var(--dim); }
  .lbl.thin { fill: var(--dim2); }
  .val { font-size: var(--fs-xs); font-weight: 650; fill: var(--txt); font-variant-numeric: tabular-nums; }
  .empty { padding: var(--sp-3); border: 1px solid var(--grid); color: var(--dim); }
</style>
