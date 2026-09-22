<script lang="ts">
  /**
   * 기록 · 역전과 데스 — 역전·리드 실패 표, 첫 데스·헌납 표, 그 아래 데스 위치 차트.
   * 비율의 분모가 0 이면 셀을 비운다('역전 0%' 는 못 한 게 아니라 기회가 없던 것이다).
   *
   * 행 선택 → 수식 줄에 근거(`=역전승률 3/7 = 43% · 리드 실패율 1/5 = 20%`), 같은 행 다시 → 멤버 화면.
   * 데스 좌표는 별도 파일이라 차트가 볼 때 받는다(DeathHeatmap). `entered` 는 이 패널이 켜졌다는 신호.
   */
  import type { GuildPayload } from '$lib/data/types';
  import { app } from '$lib/data/store.svelte';
  import { num, pct } from '$lib/fmt';
  import { setFx } from '$lib/fx.svelte';
  import { comebackRows, deathRows, type ComebackRow, type DeathRow } from '$lib/records';
  import { memberHref, router } from '$lib/router.svelte';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';
  import DeathHeatmap from '$components/charts/DeathHeatmap.svelte';

  let { data, entered = true }: { data: GuildPayload; entered?: boolean } = $props();

  const DASH = '-';
  const rate = (v: unknown) => (v == null ? DASH : pct(v as number));

  const comeback = $derived(comebackRows(data.fun?.comeback));
  const cbCols: Col<ComebackRow>[] = [
    { k: 'name', h: '멤버' },
    { k: 'behind_g', h: '열세 판', num: true },
    { k: 'comeback', h: '역전', num: true, lo: true },
    { k: 'comeback_rate', h: '역전승률', num: true, nullLast: true, hlp: '역전', fmt: rate },
    { k: 'ahead_g', h: '우세 판', num: true },
    { k: 'thrown', h: '리드 실패', num: true, lo: true },
    { k: 'throw_rate', h: '리드 실패율', num: true, nullLast: true, fmt: rate },
  ];

  const deaths = $derived(deathRows(data.fun?.deaths));
  const dCols: Col<DeathRow>[] = [
    { k: 'name', h: '멤버' },
    { k: 'games', h: '판', num: true },
    { k: 'first_death_min', h: '첫 데스', num: true, nullLast: true, hlp: '죽음', fmt: (v) => (v == null ? DASH : `${v}분`) },
    { k: 'fb_given', h: '퍼블 헌납률', num: true, nullLast: true, fmt: rate },
    { k: 'bounty_given', h: '헌납 현상금', num: true, nullLast: true, bar: true, lo: true, fmt: (v) => (v == null ? DASH : num(Math.round(v as number))) },
  ];

  let sel = $state<string | null>(null);
  function pick(key: string, fx: string, dest: string) {
    if (sel === key) { router.go(dest); return; }
    sel = key;
    setFx(fx);
  }
  const frac = (n: number, d: number, r: number | null) => (r == null ? `${n}/${d} = -` : `${n}/${d} = ${pct(r)}`);
  const cbFx = (r: ComebackRow) =>
    `=역전승률 ${frac(r.comeback, r.behind_g, r.comeback_rate)} · 리드 실패율 ${frac(r.thrown, r.ahead_g, r.throw_rate)}`;
  const dFx = (r: DeathRow) =>
    `=퍼블 헌납률 ${rate(r.fb_given)} (${r.games}판) · 첫 데스 ${r.first_death_min == null ? DASH : `${r.first_death_min}분`} · 헌납 현상금 ${r.bounty_given == null ? DASH : num(Math.round(r.bounty_given))}`;

  const load = (signal: AbortSignal) => {
    const lazy = app.lazy;
    if (!lazy) return Promise.reject(new Error('no lazy files'));
    return lazy.deathSample(signal);
  };
</script>

<div class="deaths">
  <!-- rows2: 390px 에서 417px · 409px(실측) — 폰은 2줄 장부 행 -->
  <DataTable rows={comeback} cols={cbCols} caption="역전 · 리드 실패" sortKey="throw_rate" rows2
             rowKey={(r) => `cb:${r.name}`} selectedKey={sel ?? undefined}
             onselect={(r, k) => pick(k, cbFx(r), memberHref(r.name))} />
  <p class="note">15분 골드 차 2,500 이상만 열세·우세로 봅니다. 행을 선택하면 계산 근거가 수식 줄에 보이고, 같은 행을 다시 선택하면 멤버 화면으로 이동합니다.</p>

  <!-- 데스 표와 데스 위치를 나란히 — 표가 남는 폭을 갖고 차트는 제 폭(최대 320px)만 -->
  <div class="pair">
    <DataTable rows={deaths} cols={dCols} caption="첫 데스 · 헌납" sortKey="bounty_given" rows2
               rowKey={(r) => `d:${r.name}`} selectedKey={sel ?? undefined}
               onselect={(r, k) => pick(k, dFx(r), memberHref(r.name))} />
    <DeathHeatmap {load} {entered} />
  </div>
</div>

<style>
  .deaths { display: grid; gap: var(--sp-3); min-width: 0; }
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 320px);
    gap: var(--sp-4);
    align-items: start;
  }
  .note { max-width: 75ch; font-size: var(--fs-sm); color: var(--dim); text-wrap: pretty; }
  @media (max-width: 640px) {
    .pair { grid-template-columns: 1fr; gap: var(--sp-3); }
  }
</style>
