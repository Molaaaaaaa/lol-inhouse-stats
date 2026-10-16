<script lang="ts">
  /**
   * 시너지 · 트리오 — 세 멤버가 같은 팀이었던 판의 표 카드. 열: 트리오 · 함께 판 · 승률(게이지) · 시너지.
   * 기대 승률·리프트는 payload 에 없다(계약 types.ts) — 열을 만들지 않는다.
   * 행 선택 → 수식 줄, 같은 행 다시 선택 → 첫 멤버 화면(듀오와 같은 동작).
   */
  import type { GuildPayload } from '$lib/data/types';
  import { sgn } from '$lib/fmt';
  import { setFx } from '$lib/fx.svelte';
  import { mLabel } from '$lib/metrics';
  import { memberHref, router } from '$lib/router.svelte';
  import { fxTrio, synCls, trioRows, type TrioTableRow } from '$lib/synergy';
  import { wrText } from '$lib/tier';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';
  import Panel from '$components/Panel.svelte';
  import WinGauge from '$components/WinGauge.svelte';

  interface Props { data: GuildPayload; minGames: number }
  let { data, minGames }: Props = $props();

  const rows = $derived(trioRows(data.trios));
  let selected = $state<string | null>(null);

  const cols = $derived<Col<TrioTableRow>[]>([
    { k: 'trio', h: '트리오' },
    { k: 'games', h: '함께 판', num: true },
    { k: 'winrate', h: mLabel(data.metric_meta, 'winrate'), num: true, cell: gauge, fmt: (_v, r) => wrText(r.winrate, r.games, minGames) },
    { k: 'synergy', h: '시너지', num: true, hlp: '시너지', fmt: (v) => sgn(v as number), cls: (r) => synCls(r.synergy) },
  ]);

  function onselect(r: TrioTableRow, key: string) {
    if (selected === key) { router.go(memberHref(r.a)); return; }
    selected = key;
    setFx(fxTrio(r));
  }
</script>

{#snippet gauge(r: TrioTableRow)}<WinGauge w={r.winrate} n={r.games} {minGames} />{/snippet}

<Panel title="트리오 시너지" level={3}>
  <DataTable {rows} {cols} caption="트리오 시너지" captionHidden sortKey="synergy" rowKey={(r) => r.key}
             selectedKey={selected ?? undefined} {onselect} />
  <p class="note">
    세 명이 같은 팀이었던 판만 셉니다. 함께 {minGames}판 미만의 승률은 '표본 적음'으로 적고, 색과 ▲▼는 판수를 감안해도 50%와 차이가 날 때만 붙습니다.
    행을 선택하면 계산 근거가 수식 줄에, 같은 행을 다시 선택하면 첫 멤버 화면으로 이동합니다.
  </p>
</Panel>

<style>
  .note {
    margin: var(--sp-3) 0 0;
    max-width: 75ch;
    font-size: var(--fs-sm);
    color: var(--dim);
    text-wrap: pretty;
  }
</style>
