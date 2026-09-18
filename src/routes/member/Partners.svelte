<script lang="ts">
  /**
   * 멤버 · 파트너와 상대 챔피언 — 이름 있는 범위 여섯 개를 둘씩 나란히(폰에서는 한 줄씩):
   * 잘 맞는/안 맞는 파트너(시너지 상·하위) · 상대하기 어려운/쉬운 챔피언 · 내가 잡은/나를 잡은 챔피언.
   * 파트너 행을 선택하면 그 멤버 화면으로 간다. 챔피언 표는 선택이 없다(갈 곳이 없다).
   */
  import type { GuildPayload, PartnerRow, PlayerPub, VsChampRow } from '$lib/data/types';
  import { pct, sgn } from '$lib/fmt';
  import { wrCls } from '$lib/member';
  import { mLabel } from '$lib/metrics';
  import { memberHref, router } from '$lib/router.svelte';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';

  interface Props { key: string; p: PlayerPub; data: GuildPayload }
  let { key, p, data }: Props = $props();

  const need = $derived(data.min_games ?? 5);
  const champKo = (id: string) => data.champ_ko?.[id] ?? id;

  type KillRow = { champion: string; n: number };

  const partnerCols = $derived<Col<PartnerRow>[]>([
    { k: 'partner', h: '파트너' },
    { k: 'games', h: '함께 판', num: true },
    { k: 'winrate', h: '함께 승률', num: true, fmt: (v) => pct(v as number), cls: (r) => wrCls(r.winrate, r.games, need) },
    { k: 'synergy', h: '시너지', num: true, hlp: '시너지', fmt: (v) => sgn(v as number) },
  ]);
  const champCols = $derived<Col<VsChampRow>[]>([
    { k: 'vs_champ', h: '상대 챔피언', img: (r) => r.vs_champ, fmt: (v) => champKo(String(v ?? '')) },
    { k: 'games', h: '맞라인 판', num: true },
    { k: 'winrate', h: mLabel(data.metric_meta, 'winrate'), num: true, fmt: (v) => pct(v as number), cls: (r) => wrCls(r.winrate, r.games, need) },
  ]);
  const killCols = $derived<Col<KillRow>[]>([
    { k: 'champion', h: '챔피언', img: (r) => r.champion, fmt: (v) => champKo(String(v ?? '')) },
    { k: 'n', h: '횟수', num: true },
  ]);

  const best = $derived(p.partners_best ?? []);
  const worst = $derived(p.partners_worst ?? []);
  const nemesis = $derived(p.nemesis_victim?.nemesis ?? []);
  const victim = $derived(p.nemesis_victim?.victim ?? []);
  const killed = $derived(p.killer_champions?.killed ?? []);
  const killedBy = $derived(p.killer_champions?.killed_by ?? []);

  const partnerKey = (r: PartnerRow) => r.partner;
  function open(r: PartnerRow) {
    router.go(memberHref(r.partner));
  }
</script>

<div class="partners">
  {#key key}
    <div class="pair">
      <DataTable rows={best} cols={partnerCols} caption="잘 맞는 파트너" sortKey="synergy" rowKey={partnerKey} onselect={open} />
      <DataTable rows={worst} cols={partnerCols} caption="안 맞는 파트너" sortKey="synergy" sortDir={1} rowKey={partnerKey} onselect={open} />
    </div>
    <p class="note">시너지는 함께 이긴 비율에서 각자 실력으로 기대되는 승률을 뺀 값입니다. 행을 선택하면 그 멤버 화면으로 이동합니다.</p>
    <div class="pair">
      <DataTable rows={nemesis} cols={champCols} caption="상대하기 어려운 챔피언" />
      <DataTable rows={victim} cols={champCols} caption="상대하기 쉬운 챔피언" />
    </div>
    <div class="pair">
      <DataTable rows={killed} cols={killCols} caption="내가 잡은 챔피언" sortKey="n" />
      <DataTable rows={killedBy} cols={killCols} caption="나를 잡은 챔피언" sortKey="n" />
    </div>
  {/key}
</div>

<style>
  .partners { display: grid; gap: var(--sp-3); }
  /* minmax(0, …): 표가 열보다 넓으면 격자 항목이 늘어나 문서가 넘친다 — 0 으로 잡아 표 안에서만 스크롤 */
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-4);
    align-items: start;
  }
  .note {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--dim);
    text-wrap: pretty;
  }
  @media (max-width: 640px) {
    .pair { grid-template-columns: 1fr; gap: var(--sp-3); }
  }
</style>
