<script lang="ts">
  /**
   * 멤버 · 최근 경기와 시간대 — 최근 경기 표(시각·챔피언·라인·결과·KDA·분당 딜) 한 장과
   * 시간대별 판수 차트 하나. 승률은 시간대에 싣지 않는다(HourBars 참고).
   * 경기 상세로 가는 링크는 없다 — recent_games 에는 경기 슬러그가 실리지 않는다(있다고 가정하지 않는다).
   */
  import type { GuildPayload, PlayerPub, PlayerRecentGame } from '$lib/data/types';
  import { dateTimeKo, fmtMetric } from '$lib/fmt';
  import { laneKo } from '$lib/lanes';
  import { laneCls } from '$lib/member';
  import { hourRows } from '$lib/member-rest';
  import { mLabel } from '$lib/metrics';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';
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
    { k: 'lane', h: '라인', fmt: (v) => laneKo(v as string), cls: (r) => laneCls(r.lane) },
    { k: 'win', h: '결과', fmt: (v) => (v ? '승' : '패'), cls: (r) => (r.win ? 'win' : 'loss') },
    { k: 'kda', h: mLabel(data.metric_meta, 'kda'), num: true, fmt: (v) => fmtMetric('kda', v as number, data.metric_meta) },
    { k: 'dpm', h: mLabel(data.metric_meta, 'dpm'), num: true, lo: true, fmt: (v) => fmtMetric('dpm', v as number, data.metric_meta) },
  ]);
</script>

<div class="recent">
  {#key key}
    <DataTable {rows} {cols} caption="최근 경기" sortKey="game_creation" />
    <HourBars rows={hours} />
  {/key}
</div>

<style>
  .recent { display: grid; gap: var(--sp-3); }
</style>
