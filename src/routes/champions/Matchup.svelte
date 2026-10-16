<script lang="ts">
  /**
   * 챔피언 · 매치업 — 라인 매치업 표 카드 한 장(챔피언 · 상대 챔피언 · 라인 · 판 · 승률 게이지), 판수 내림차순.
   * 승률은 왼쪽 챔피언 기준. 승률 단계(색·▲▼)는 구간 기준이고 문턱 미만은 '표본 적음'.
   * 행 선택은 없다(갈 곳이 없다). 행 만들기는 $lib/champions 의 순수 함수.
   */
  import type { GuildPayload } from '$lib/data/types';
  import { laneKo } from '$lib/lanes';
  import { mLabel } from '$lib/metrics';
  import { matchupRows, type MatchupRow } from '$lib/champions';
  import { wrText } from '$lib/tier';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';
  import LaneChip from '$components/LaneChip.svelte';
  import Panel from '$components/Panel.svelte';
  import WinGauge from '$components/WinGauge.svelte';

  let { data }: { data: GuildPayload } = $props();

  const rows = $derived(matchupRows(data));
  const need = $derived(data.min_games ?? 5);
  const cols = $derived<Col<MatchupRow>[]>([
    { k: 'name', h: '챔피언', img: (r) => r.champ },
    { k: 'vsName', h: '상대 챔피언', img: (r) => r.vs },
    { k: 'laneOrd', h: '라인', lo: true, cell: laneCell, fmt: (_v, r) => laneKo(r.lane) },
    { k: 'games', h: '판', num: true, bar: true },
    { k: 'winrate', h: mLabel(data.metric_meta, 'winrate'), num: true, cell: gauge, fmt: (_v, r) => wrText(r.winrate, r.games, need) },
  ]);
  const LOWER = ['laneOrd'];
</script>

{#snippet gauge(r: MatchupRow)}<WinGauge w={r.winrate} n={r.games} minGames={need} />{/snippet}
{#snippet laneCell(r: { lane?: string | null })}<LaneChip lane={r.lane} />{/snippet}

<Panel title="라인 매치업" level={3} glyph="versus">
  <DataTable {rows} {cols} caption="라인 매치업" captionHidden sortKey="games" lowerBetterKeys={LOWER} />
  <p class="note">같은 라인에서 맞붙은 챔피언 조합입니다. 승률은 왼쪽 챔피언 기준입니다.</p>
</Panel>

<style>
  .note { margin: var(--sp-3) 0 0; max-width: 75ch; color: var(--dim); font-size: var(--fs-sm); text-wrap: pretty; }
</style>
