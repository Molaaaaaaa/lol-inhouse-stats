<script lang="ts">
  /**
   * 챔피언 · 밴 — `ban_available` 이면 밴 표(챔피언 · 밴 수, 밴 수 내림차순), 아니면 빈 상태 한 문장.
   * 빈 표를 두면 "아무도 밴을 안 했다" 로 읽히므로 왜 없는지를 적는다(옛 화면과 같은 이유).
   * 행 만들기는 $lib/champions 의 순수 함수.
   */
  import type { GuildPayload } from '$lib/data/types';
  import { banRows, type BanTableRow } from '$lib/champions';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';
  import EmptyState from '$components/EmptyState.svelte';

  let { data }: { data: GuildPayload } = $props();

  const rows = $derived(banRows(data));
  const cols: Col<BanTableRow>[] = [
    { k: 'name', h: '챔피언', img: (r) => r.champ },
    { k: 'bans', h: '밴 수', num: true, bar: true },
  ];
</script>

<div class="ban">
  {#if !data.ban_available}
    <EmptyState text="이 서버의 기록 방식에는 밴 정보가 없습니다." />
  {:else}
    <DataTable {rows} {cols} caption="밴" sortKey="bans" />
  {/if}
</div>

<style>
  /* 두 열뿐인 표를 화면 폭에 늘리면 막대가 한 뼘짜리 셀이 된다 — 장부의 열 폭으로 잡는다 */
  .ban { min-width: 0; max-width: 36rem; }
</style>
