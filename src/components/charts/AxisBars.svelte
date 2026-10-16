<script lang="ts">
  /**
   * 능력치 축 표 — 육각형 옆에서 같은 축을 정확한 값으로 다시 보여 준다. 도형은 모양을, 표는 숫자를.
   * 카드 안 표 한 장: 축 · 점수(데이터 막대, 눈금 max 기준) · 순위 rank/n · 변화(▲▼, 지난 내전 대비) · 판.
   * 막대는 별도 요소 없이 셀 아래쪽 3px 띠(--bar 너비 · --grad-win, DataTable 의 데이터 막대와 같은 모양).
   * 판수가 문턱 미만인 축은 글자를 옅게(--dim2) — 점수는 평균 쪽으로 보정된 값이라는 신호.
   */
  import type { GuildPayload, ProfileAxis } from '$lib/data/types';
  import { axisDigits, deltaText } from '$lib/member';
  import { fmtMetric } from '$lib/fmt';
  import type { MetricMetaMap } from '$lib/metrics';

  interface Props {
    axes: readonly ProfileAxis[];
    scale: Pick<GuildPayload['profile_scale'], 'max' | 'step'> | null | undefined;
    minGames?: number;
    /** 지표 서식 — 축을 만든 지표 값(title)에 쓴다 */
    meta?: MetricMetaMap | null;
    caption?: string;
  }
  let { axes, scale, minGames = 0, meta = null, caption = '능력치 축' }: Props = $props();

  const MAX = $derived(scale?.max || 5);
  const digits = $derived(axisDigits(scale?.step));
  const bar = (a: ProfileAxis) => `${Math.round(Math.max(0, Math.min(1, a.score / MAX)) * 1000) / 10}%`;
  const thin = (a: ProfileAxis) => minGames > 0 && a.games != null && a.games < minGames;
  /** 축을 만든 지표와 값 — 한 축이 지표 둘로 되어 있으면 둘 다 */
  const parts = (a: ProfileAxis) => (a.parts ?? []).map((x) => `${x.label} ${fmtMetric(x.key, x.value, meta)}`).join(' · ');
</script>

<div class="axbars">
  <div class="cap">{caption}</div>
  {#if axes.length === 0}
    <p class="empty">아직 능력치가 없습니다.</p>
  {:else}
    <table aria-label={caption}>
      <thead>
        <tr>
          <th scope="col">축</th>
          <th scope="col" class="num">점수</th>
          <th scope="col" class="num">순위</th>
          <th scope="col" class="num">변화</th>
          <th scope="col" class="num lo">판</th>
        </tr>
      </thead>
      <tbody>
        {#each axes as a (a.key)}
          <tr class:thin={thin(a)}>
            <td class="ax" title={parts(a) || undefined}>{a.label}</td>
            <td class="num bar" style:--bar={bar(a)}>{a.score.toFixed(digits)}</td>
            <td class="num">{a.rank}/{a.n}위</td>
            <td class="num delta">{deltaText(a.delta)}</td>
            <td class="num lo">{a.games ?? '-'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  /* 카드 안 표 — DataTable 과 같은 어휘: 세로 격자선 없이 행 구분선만, 머리행은 --gutter 에 위 모서리 12px.
     --bar 는 셀마다 인라인(style:--bar)으로 들어온다 — 기본 0% 면 막대가 없다 */
  .axbars { --bar: 0%; width: 100%; }
  .cap { font-size: var(--fs-sm); font-weight: 700; color: var(--dim); padding: 0 0 var(--sp-2); white-space: nowrap; }
  .empty { margin: 0; padding: var(--sp-3); background: var(--ink); border: 1px solid var(--grid); border-radius: var(--r-md); color: var(--dim); }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-variant-numeric: tabular-nums;
  }
  th, td {
    height: var(--row-h);
    padding: 0 var(--sp-2);
    text-align: left;
    white-space: nowrap;
    vertical-align: middle;
    border-bottom: 1px solid var(--grid);
  }
  tbody tr:last-child td { border-bottom-color: transparent; }
  thead th {
    background: var(--gutter);
    color: var(--dim);
    font-size: var(--fs-sm);
    font-weight: 700;
    border-bottom: 1px solid var(--grid-strong);
  }
  thead th:first-child { border-top-left-radius: var(--r-md); }
  thead th:last-child { border-top-right-radius: var(--r-md); }
  .num { text-align: right; }
  .ax { width: 40%; }
  tbody tr { transition: background-color var(--dur-1); }
  tbody tr:hover { background: color-mix(in srgb, var(--raised) 70%, transparent); }
  .thin td { color: var(--dim); }
  .delta { color: var(--dim); }
  /* 점수 막대 — DataTable 의 데이터 막대와 같은 모양: 셀 아래쪽 3px 띠(눈금 max 기준 절대 너비) */
  td.bar {
    background-image: var(--grad-win);
    background-size: var(--bar) 3px;
    background-position: left bottom 4px;
    background-repeat: no-repeat;
  }
  @media (max-width: 640px) {
    .lo { display: none; }
    th, td { padding: 0 var(--sp-1) 0 6px; }
  }
  @media (prefers-reduced-motion: reduce) {
    tbody tr { transition: none; }
  }
</style>
