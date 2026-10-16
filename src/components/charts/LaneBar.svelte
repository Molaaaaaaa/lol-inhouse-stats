<script lang="ts">
  /**
   * 라인 분포 막대 — 둥근 우물 안의 누적 데이터 막대. 머리 칸에 전체 판수, 몸통은 라인 판수
   * 비율로 나뉜 조각(라인 색 채움, 조각 사이 2px 틈), 조각마다 '탑 28' 글자.
   * 조각이 글자보다 좁으면(3.5em 미만 — 2판짜리는 12px 쯤) 글자를 숨긴다(컨테이너 쿼리, JS 없음).
   * 그래서 전체 내용은 늘 두 곳에 더 있다: aria-label, 그리고 막대 아래 한 줄 범례 '탑 2 · 원딜 2 · …'.
   * 색만으로 읽히지 않는다. 도넛(Donut.svelte)을 대신한다 — 큰 숫자 링으로 같은 판수를 한 번 더 그리지 않는다.
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
  /* 한 줄 막대: 머리 칸(전체 판수, 카드 머리 판 --gutter) + 몸통. 둥근 우물(8px) 안에서 조각 사이 2px 틈 */
  .lanebar {
    display: flex;
    align-items: stretch;
    min-height: var(--row-h);
    overflow: hidden;
    background: var(--ink);
    border: 1px solid var(--grid);
    border-radius: var(--r-chip);
  }
  .th {
    flex: none;
    display: flex;
    align-items: center;
    min-width: 5ch;
    padding: 0 var(--sp-3);
    background: var(--gutter);
    color: var(--txt);
    font-size: var(--fs-sm);
    font-weight: 700;
    white-space: nowrap;
  }
  .track { flex: 1 1 auto; min-width: 0; display: flex; gap: 2px; padding-left: 2px; }
  /* 조각: 판수만큼 자란다(flex-grow = 판수). 라인 색 채움(34%) — 글자(txt)는 어느 라인 위에서도 6.8:1 이상(실측 탑 6.88).
     container-type: 조각 폭을 쿼리해 좁으면 글자를 뺀다(폭은 flex 가 정하므로 글자가 폭에 영향을 못 준다) */
  .seg {
    --w: 1;
    --c: var(--grid-strong);
    flex: var(--w) 1 0;
    min-width: 0;
    container-type: inline-size;
    display: flex;
    align-items: center;
    padding: 0 var(--sp-2);
    background: color-mix(in srgb, var(--c) 34%, transparent);
    font-size: var(--fs-sm);
    color: var(--txt);
  }
  .lb { min-width: 0; overflow: hidden; white-space: nowrap; font-variant-numeric: tabular-nums; }
  @container (width < 3.5em) {
    .lb { display: none; }
  }
  .top { --c: var(--lane-top); }
  .jg { --c: var(--lane-jg); }
  .mid { --c: var(--lane-mid); }
  .bot { --c: var(--lane-bot); }
  .sup { --c: var(--lane-sup); }
  /* 강제 색상: 채움이 지워진다 — 조각 경계를 선으로 남긴다(글자·범례가 라인을 말한다) */
  @media (forced-colors: active) {
    .seg { border-left: 1px solid CanvasText; }
  }
  /* 범례 — 막대 아래 한 줄, 좁아서 글자가 숨은 조각도 여기서 읽힌다 */
  .lg { margin: 0; padding-top: var(--sp-2); font-size: var(--fs-sm); color: var(--dim); font-variant-numeric: tabular-nums; }
  .empty { margin: 0; padding: var(--sp-3); background: var(--ink); border: 1px solid var(--grid); border-radius: var(--r-chip); color: var(--dim); }
</style>
