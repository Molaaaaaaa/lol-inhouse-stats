<script lang="ts">
  /**
   * 라인 분포 막대 — 격자 한 행처럼 생긴 누적 데이터 막대. 행 머리 셀에 전체 판수, 몸통은 라인 판수
   * 비율로 나뉜 조각(라인 띠 색 옅은 채움 + 왼쪽 3px 띠), 조각마다 '탑 28' 글자.
   * 조각이 글자보다 좁으면(3.5em 미만 — 2판짜리는 12px 쯤) 글자를 숨긴다(컨테이너 쿼리, JS 없음).
   * 그래서 전체 내용은 늘 두 곳에 더 있다: aria-label, 그리고 막대 아래 한 줄 범례 '탑 2 · 원딜 2 · …'.
   * 색만으로 읽히지 않는다. 도넛(Donut.svelte)을 대신한다 — 큰 숫자 링은 이 세계(표가 곧 화면)의 문법이 아니다.
   */
  import type { LaneId } from '$lib/data/types';
  import { laneKo } from '$lib/lanes';
  import { laneBand } from '$lib/member';

  interface Props {
    dist: readonly { lane: LaneId | string; games: number; pct?: number }[];
    label?: string;
  }
  let { dist, label = '라인 분포' }: Props = $props();

  const band = (l: string) => laneBand(l) || 'none';
  const rows = $derived(dist.filter((x) => (Number(x.games) || 0) > 0));
  const total = $derived(rows.reduce((t, x) => t + (Number(x.games) || 0), 0));
  const summary = $derived(rows.map((x) => `${laneKo(x.lane)} ${x.games}판`).join(', '));
  const legend = $derived(rows.map((x) => `${laneKo(x.lane)} ${x.games}`).join(' · '));
</script>

{#if rows.length === 0}
  <p class="empty">아직 출전 기록이 없습니다.</p>
{:else}
  <div class="lanebar" role="img" aria-label="{label}: 전체 {total}판 · {summary}">
    <div class="th num">{total}판</div>
    <div class="track">
      {#each rows as x (x.lane)}
        <div class="seg {band(x.lane)}" style:--w={x.games}>
          <span class="lb">{laneKo(x.lane)} {x.games}</span>
        </div>
      {/each}
    </div>
  </div>
  <p class="lg" aria-hidden="true">{legend}</p>
{/if}

<style>
  /* 한 행: 머리 셀(홈통 바탕, 오른쪽 굵은 선) + 몸통. 높이는 표 행과 같다 */
  .lanebar {
    display: flex;
    align-items: stretch;
    min-height: var(--row-h);
    border: 1px solid var(--grid);
    background: var(--sheet);
  }
  .th {
    flex: none;
    display: flex;
    align-items: center;
    min-width: 5ch;
    padding: 0 var(--sp-2);
    background: var(--gutter);
    color: var(--txt);
    font-size: var(--fs-sm);
    font-weight: 650;
    border-right: 1px solid var(--grid-strong);
    white-space: nowrap;
  }
  .track { flex: 1 1 auto; min-width: 0; display: flex; }
  /* 조각: 판수만큼 자란다(flex-grow = 판수). 왼쪽 3px 띠 + 옅은 채움 — 라인 셀과 같은 문법.
     container-type: 조각 폭을 쿼리해 좁으면 글자를 뺀다(폭은 flex 가 정하므로 글자가 폭에 영향을 못 준다) */
  .seg {
    --w: 1;
    flex: var(--w) 1 0;
    min-width: 0;
    container-type: inline-size;
    display: flex;
    align-items: center;
    padding: 0 var(--sp-1) 0 calc(3px + var(--sp-1));
    box-shadow: inset 3px 0 0 var(--grid-strong);
    background: color-mix(in srgb, var(--grid-strong) 30%, transparent);
    font-size: var(--fs-sm);
    color: var(--txt);
  }
  .seg + .seg { border-left: 1px solid var(--sheet); }
  .lb { min-width: 0; overflow: hidden; white-space: nowrap; font-variant-numeric: tabular-nums; }
  @container (width < 3.5em) {
    .lb { display: none; }
  }
  .top { box-shadow: inset 3px 0 0 var(--lane-top); background: color-mix(in srgb, var(--lane-top) 30%, transparent); }
  .jg { box-shadow: inset 3px 0 0 var(--lane-jg); background: color-mix(in srgb, var(--lane-jg) 30%, transparent); }
  .mid { box-shadow: inset 3px 0 0 var(--lane-mid); background: color-mix(in srgb, var(--lane-mid) 30%, transparent); }
  .bot { box-shadow: inset 3px 0 0 var(--lane-bot); background: color-mix(in srgb, var(--lane-bot) 30%, transparent); }
  .sup { box-shadow: inset 3px 0 0 var(--lane-sup); background: color-mix(in srgb, var(--lane-sup) 30%, transparent); }
  /* 범례 — 막대 아래 한 줄, 좁아서 글자가 숨은 조각도 여기서 읽힌다 */
  .lg { margin: 0; padding-top: var(--sp-1); font-size: var(--fs-xs); color: var(--dim); font-variant-numeric: tabular-nums; }
  .empty { margin: 0; padding: var(--sp-3); border: 1px solid var(--grid); color: var(--dim); }
</style>
