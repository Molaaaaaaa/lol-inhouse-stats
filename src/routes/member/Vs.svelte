<script lang="ts">
  /**
   * 멤버 · 상대별 전적 — '나 기준' 한 표. 왼쪽이 항상 상대이고 승패·킬은 전부 내 쪽에서 센다
   * (뒤집기 규칙은 $lib/member-rest 의 vsRows). 표 아래 열 뜻풀이 한 줄.
   * 행 합계는 싣지 않는다 — 한 판이 상대 다섯 명에게 한 번씩 세어져 29판인 사람이 '맞대결 145판' 이 된다
   * (옛 화면이 그렇게 적었다). 실제 전적은 멤버 머리의 전적 셀이 든다.
   * 행을 선택하면 그 멤버 화면으로 간다(DataTable 셀에는 링크를 못 넣으므로 행 전체가 링크다).
   */
  import type { GuildPayload, PlayerPub } from '$lib/data/types';
  import { pct } from '$lib/fmt';
  import { wrCls } from '$lib/member';
  import { vsRows, type VsRow } from '$lib/member-rest';
  import { memberHref, router } from '$lib/router.svelte';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';

  /** p 는 계약상 받지만 여기서는 안 쓴다 — 행의 출처는 data.h2h + key 다 */
  interface Props { key: string; p: PlayerPub; data: GuildPayload }
  let { key, data }: Props = $props();

  const rows = $derived(vsRows(data, key));
  const need = $derived(data.min_games ?? 5);

  const wr = (v: unknown) => (v == null ? '' : pct(v as number));
  const cols = $derived<Col<VsRow>[]>([
    { k: 'opp', h: '상대' },
    { k: 'withGames', h: '함께 판', num: true },
    { k: 'withWr', h: '함께 승률', num: true, nullLast: true, fmt: wr, cls: (r) => wrCls(r.withWr, r.withGames, need) },
    { k: 'vsGames', h: '맞대결 판', num: true },
    { k: 'vsWr', h: '맞대결 승률', num: true, nullLast: true, fmt: wr, cls: (r) => wrCls(r.vsWr, r.vsGames, need) },
    { k: 'kills', h: '킬', num: true, lo: true, nullLast: true },
    { k: 'deaths', h: '데스', num: true, lo: true, nullLast: true },
  ]);

  function open(r: VsRow) {
    router.go(memberHref(r.opp));
  }
</script>

<div class="vs">
  {#key key}
    <!-- rows2: 390px 에서 413px(실측) — 폰은 2줄 장부 행 -->
    <DataTable {rows} {cols} caption="상대별 전적" sortKey="withGames" rowKey={(r) => r.key} onselect={open} rows2 />
  {/key}
  {#if rows.length}
    <p class="note">
      함께 = 한 팀이었던 판 · 맞대결 = 적으로 만난 판 · 킬·데스 = 맞대결에서 내가 잡은 수·잡힌 수.
      승률 채움은 {need}판 이상부터입니다. 행을 선택하면 그 멤버 화면으로 이동합니다.
    </p>
  {/if}
</div>

<style>
  .vs { display: grid; gap: var(--sp-2); }
  .note {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--dim);
    text-wrap: pretty;
  }
</style>
