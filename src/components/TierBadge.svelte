<script module lang="ts">
  import { cpTiers, tierBadge, type TierSource } from '$lib/tier';

  /**
   * CP → 티어 이름. 컷은 payload(`cp_constants.tiers`, 위에서 아래로)에서만 — 위에서부터 바닥(cp)
   * 이상인 첫 티어이고, 바닥이 null 인 마지막 티어가 나머지를 받는다(`inhouse/cp.py:tier_index` 와
   * 같은 규칙). 컷이 없으면 '' — 티어는 어디에도 안 보인다.
   */
  export function tierNameOf(data: TierSource, cp: number): string {
    for (const t of cpTiers(data)) if (t.cp == null || cp >= t.cp) return t.name;
    return '';
  }

  /** 배치 판수 — 호출부가 안 주면 payload 의 `cp_constants.placement_games` 를 본다. 둘 다 없으면 0. */
  function placementOf(data: TierSource): number {
    const c: unknown = data?.cp_constants;
    if (c && typeof c === 'object' && 'placement_games' in c) return Number((c as { placement_games?: unknown }).placement_games) || 0;
    return 0;
  }
</script>

<script lang="ts">
  /**
   * 티어 셀 — 인라인 span 하나.
   *
   * ⚠️ 배치 전(`placed=false`)에는 티어 이름도, 티어 색도 **어디에도** 안 보인다. 그 자리에 점선 테두리와
   *    '배치 n/5' 글자만 둔다. 배치 구간은 K 가 커서 한두 판으로 티어가 크게 흔들리기 때문이다.
   * 배치 후에는 `--tN` 16% 채움 + 티어 이름 글자(항상 — 색만으로 구분하지 않는다).
   */
  interface Props {
    cp: number;
    placed: boolean;
    /** 배치 진행 판수 — placed=false 일 때 '배치 n/…' 의 n */
    games?: number;
    /** 배치에 필요한 판수(payload `cp_constants.placement_games`). 안 주면 data 에서 찾는다 */
    placementGames?: number;
    /** 티어 컷의 출처 — payload 전체나 `{ cp_constants }` 조각 */
    data: TierSource;
    /** payload 가 이미 준 티어 이름(`CpEntry.tier`). 주면 cp 에서 다시 계산하지 않는다 */
    tier?: string;
  }
  let { cp, placed, games = 0, placementGames, data, tier }: Props = $props();

  const name = $derived(tier ?? tierNameOf(data, cp));
  const badge = $derived(tierBadge(name, data));
  // 채움 색은 컷 목록에서의 순번(1티어부터) — 이름을 파싱하지 않는다
  const idx = $derived(cpTiers(data).findIndex((t) => t.name === name) + 1);
  const need = $derived(placementGames ?? placementOf(data));
</script>

{#if !placed}
  <span class="placing">{need ? `배치 ${games}/${need}` : `배치 중 ${games}판`}</span>
{:else if badge.label}
  <span class="{badge.cls} t{idx}">{badge.label}</span>
{/if}

<style>
  .tierbadge, .placing {
    display: inline-block;
    padding: 0 var(--sp-2);
    font-size: var(--fs-sm);
    line-height: 1.6;
    white-space: nowrap;
    vertical-align: baseline;
  }
  .tierbadge { font-weight: 600; }
  /* 조건부 서식 — 셀 채움만 옅게, 글자는 무채색 그대로 */
  .t1 { background: color-mix(in srgb, var(--t1) 16%, transparent); }
  .t2 { background: color-mix(in srgb, var(--t2) 16%, transparent); }
  .t3 { background: color-mix(in srgb, var(--t3) 16%, transparent); }
  .t4 { background: color-mix(in srgb, var(--t4) 16%, transparent); }
  .t5 { background: color-mix(in srgb, var(--t5) 16%, transparent); }
  /* 배치 미완 — 비어 있는 셀. 티어 색은 이 규칙 어디에도 없다 */
  .placing {
    border: 1px dashed var(--grid-strong);
    color: var(--dim);
    font-variant-numeric: tabular-nums;
  }
</style>
