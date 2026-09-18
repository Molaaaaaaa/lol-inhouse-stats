<script lang="ts">
  /**
   * 챔피언 · 매치업 — 라인 매치업 표 한 장(챔피언 · 상대 챔피언 · 라인 · 판 · 승률), 판수 내림차순.
   * 승률은 왼쪽 챔피언 기준. 행 선택은 없다(갈 곳이 없다). 행 만들기는 $lib/champions 의 순수 함수.
   */
  import type { GuildPayload } from '$lib/data/types';
  import { pct } from '$lib/fmt';
  import { laneKo } from '$lib/lanes';
  import { laneCls, wrCls } from '$lib/member';
  import { mLabel } from '$lib/metrics';
  import { matchupRows, type MatchupRow } from '$lib/champions';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';

  let { data }: { data: GuildPayload } = $props();

  const rows = $derived(matchupRows(data));
  const need = $derived(data.min_games ?? 5);
  const cols = $derived<Col<MatchupRow>[]>([
    { k: 'name', h: '챔피언', img: (r) => r.champ },
    { k: 'vsName', h: '상대 챔피언', img: (r) => r.vs },
    { k: 'laneOrd', h: '라인', lo: true, fmt: (_v, r) => laneKo(r.lane), cls: (r) => laneCls(r.lane) },
    { k: 'games', h: '판', num: true, bar: true },
    { k: 'winrate', h: mLabel(data.metric_meta, 'winrate'), num: true, fmt: (v) => pct(v as number), cls: (r) => wrCls(r.winrate, r.games, need) },
  ]);
  const LOWER = ['laneOrd'];
</script>

<div class="matchup">
  <DataTable {rows} {cols} caption="라인 매치업" sortKey="games" lowerBetterKeys={LOWER} />
  <p class="note">같은 라인에서 맞붙은 챔피언 조합입니다. 승률은 왼쪽 챔피언 기준입니다.</p>
</div>

<style>
  .matchup { display: grid; gap: var(--sp-3); }
  .note { margin: 0; max-width: 75ch; color: var(--dim); font-size: var(--fs-sm); text-wrap: pretty; }
</style>
