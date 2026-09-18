<script lang="ts">
  /**
   * 시너지 · 히트맵 — 멤버 × 멤버 격자(SynergyHeatmap). 칸 선택 → 수식 줄에 그 듀오의 근거,
   * 같은 칸 다시 선택 → 행 멤버 화면. 문턱은 payload 의 min_games(칸이 비는 기준).
   */
  import type { GuildPayload } from '$lib/data/types';
  import { setFx } from '$lib/fx.svelte';
  import { memberHref, router } from '$lib/router.svelte';
  import { fxDuo, type HeatCell } from '$lib/synergy';
  import SynergyHeatmap from '$components/charts/SynergyHeatmap.svelte';

  interface Props { data: GuildPayload; minGames: number }
  let { data, minGames }: Props = $props();

  let selected = $state<string | null>(null);

  function onselect(c: HeatCell) {
    if (selected === c.key) { router.go(memberHref(c.a)); return; }
    selected = c.key;
    setFx(fxDuo({ winrate: c.winrate, expected: c.expected, lift: c.lift, synergy: c.synergy ?? 0, games: c.games }));
  }
</script>

<div class="heat">
  <SynergyHeatmap synergy={data.synergy ?? []} {minGames} selectedKey={selected ?? undefined} {onselect} />
  <p class="note">
    칸의 값은 시너지(기대 승률 대비, 판수 보정)이고 색의 세기는 표의 실값 최대를 기준으로 합니다.
    칸을 선택하면 계산 근거가 수식 줄에, 같은 칸을 다시 선택하면 행의 멤버 화면으로 이동합니다.
  </p>
</div>

<style>
  /* minmax(0, …): 격자가 열보다 넓어도 항목이 늘어나지 않게 — 스크롤은 격자 래퍼 안에서만 */
  .heat { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-3); }
  .note {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--dim);
    text-wrap: pretty;
  }
</style>
