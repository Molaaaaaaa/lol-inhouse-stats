<script lang="ts">
  /**
   * 멤버 · 최근 경기와 시간대 — 최근 경기 카드(표: 시각·챔피언·라인·결과·KDA·분당 딜) 한 장과
   * 시간대별 판수 카드 하나(HourBars 의 캡션은 captionHidden — 카드 제목이 같은 말). 승률은 시간대에 싣지 않는다(HourBars 참고).
   * 경기 상세로 가는 링크는 없다 — recent_games 에는 경기 슬러그가 실리지 않는다(있다고 가정하지 않는다).
   */
  import type { GuildPayload, PlayerPub, PlayerRecentGame } from '$lib/data/types';
  import { dateTimeKo, fmtMetric } from '$lib/fmt';
  import { laneKo } from '$lib/lanes';
  import { hourRows } from '$lib/member-rest';
  import { mLabel } from '$lib/metrics';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';
  import Panel from '$components/Panel.svelte';
  import LaneChip from '$components/LaneChip.svelte';
  import HourBars from '$components/charts/HourBars.svelte';

  interface Props { key: string; p: PlayerPub; data: GuildPayload }
  let { key, p, data }: Props = $props();

  type Row = PlayerRecentGame;
  const rows = $derived<Row[]>(p.recent_games ?? []);
  const hours = $derived(hourRows(p.by_hour));

  const champKo = (id: string) => data.champ_ko?.[id] ?? id;
  const cols = $derived<Col<Row>[]>([
    { k: 'game_creation', h: '시각', fmt: (v) => dateTimeKo(v as number) },
    { k: 'champion_name', h: '챔피언', img: (r) => r.champion_name, fmt: (v) => champKo(String(v ?? '')) },
    { k: 'lane', h: '라인', cell: laneCell, fmt: (v) => laneKo(v as string) },
    { k: 'win', h: '결과', fmt: (v) => (v ? '승' : '패'), cls: (r) => (r.win ? 'win' : 'loss') },
    { k: 'kda', h: mLabel(data.metric_meta, 'kda'), num: true, fmt: (v) => fmtMetric('kda', v as number, data.metric_meta) },
    { k: 'dpm', h: mLabel(data.metric_meta, 'dpm'), num: true, lo: true, fmt: (v) => fmtMetric('dpm', v as number, data.metric_meta) },
  ]);
</script>

{#snippet laneCell(r: Row)}<LaneChip lane={r.lane} />{/snippet}

<div class="recent">
  {#key key}
    <Panel title="최근 경기">
      <DataTable {rows} {cols} caption="최근 경기" captionHidden sortKey="game_creation" />
    </Panel>
    <Panel title="시간대별 판수">
      <HourBars rows={hours} captionHidden />
    </Panel>
  {/key}
</div>

<style>
  .recent { display: grid; gap: var(--sp-4); }
</style>
