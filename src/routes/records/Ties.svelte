<script lang="ts">
  /**
   * 기록 · 관계 — 두 멤버 사이의 사실: 동반 사망 · 어시스트 흐름 · 연속킬과 저지. 시너지 화면에서 옮겨 왔다
   * (옛 renderFun 의 관계 지표). 표 이름은 사실 그대로 — 농담 이름은 쓰지 않는다(옛 결정).
   *
   * 행 선택 → 수식 줄에 근거(`=판당 동반 사망 7/2판 = 3.5`), 같은 행 다시 → 두 사람이면 비교 화면(`#/m/a/vs/b`),
   * 한 사람이면 멤버 화면.
   */
  import type { FunStats, GuildPayload } from '$lib/data/types';
  import { pct } from '$lib/fmt';
  import { setFx } from '$lib/fx.svelte';
  import { compareHref, memberHref, router } from '$lib/router.svelte';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';

  let { data }: { data: GuildPayload } = $props();

  type CoRow = FunStats['co_deaths'][number];
  type FlowRow = FunStats['assist_flow'][number];
  type SpreeRow = FunStats['sprees']['sprees'][number];
  type StopRow = FunStats['sprees']['stoppers'][number];

  const champKo = (id: string) => data.champ_ko?.[id] ?? id;

  const co = $derived<CoRow[]>(data.fun?.co_deaths ?? []);
  const coCols: Col<CoRow>[] = [
    { k: 'a', h: '멤버 A' },
    { k: 'b', h: '멤버 B' },
    { k: 'games', h: '함께 판', num: true },
    { k: 'n', h: '동반 사망', num: true, lo: true },
    { k: 'per_game', h: '판당', num: true, bar: true, hlp: '동반사망', fmt: (v) => (Number(v) || 0).toFixed(2) },
  ];

  const flow = $derived<FlowRow[]>(data.fun?.assist_flow ?? []);
  const flowCols: Col<FlowRow>[] = [
    { k: 'giver', h: '어시스트 멤버' },
    { k: 'taker', h: '킬 멤버' },
    { k: 'assists', h: '어시', num: true },
    { k: 'taker_kills', h: '킬 멤버 킬', num: true, lo: true },
    { k: 'share', h: '비중', num: true, bar: true, hlp: '어시스트', fmt: (v) => pct(v as number) },
    { k: 'games', h: '함께 판', num: true, lo: true },
  ];

  const sprees = $derived<SpreeRow[]>(data.fun?.sprees?.sprees ?? []);
  const spreeCols: Col<SpreeRow>[] = [
    { k: 'name', h: '멤버' },
    { k: 'champ', h: '챔피언', img: (r) => r.champ, fmt: (v) => champKo(String(v ?? '')) },
    { k: 'streak', h: '연속킬', num: true, bar: true },
    { k: 'minute', h: '시점', num: true, lo: true, fmt: (v) => `${v}분` },
  ];

  const stops = $derived<StopRow[]>(data.fun?.sprees?.stoppers ?? []);
  const stopCols: Col<StopRow>[] = [
    { k: 'stopper', h: '저지 멤버' },
    { k: 'runner', h: '연속킬 멤버' },
    { k: 'streak', h: '당시 연속킬', num: true, bar: true },
  ];

  let sel = $state<string | null>(null);
  function pick(key: string, fx: string, dest: string) {
    if (sel === key) { router.go(dest); return; }
    sel = key;
    setFx(fx);
  }
  const coFx = (r: CoRow) => `=판당 동반 사망 ${r.n}/${r.games}판 = ${(Number(r.per_game) || 0).toFixed(2)} · ${r.a} · ${r.b}`;
  const flowFx = (r: FlowRow) => `=비중 ${r.assists}/${r.taker_kills}킬 = ${pct(r.share)} · ${r.giver} → ${r.taker} · 함께 ${r.games}판`;
  const spreeFx = (r: SpreeRow) => `=연속킬 ${r.streak} · ${r.name} · ${champKo(r.champ)} · ${r.minute}분`;
  const stopFx = (r: StopRow) => `=연속킬 ${r.streak} 저지 · ${r.stopper} → ${r.runner}`;
</script>

<div class="ties">
  <div class="pair">
    <!-- rows2: 390px 에서 377px(실측) — 폰은 2줄 장부 행. 어시스트 흐름은 366px 에 든다 -->
    <DataTable rows={co} cols={coCols} caption="동반 사망" sortKey="per_game" rows2
               rowKey={(r) => `co:${r.a}|${r.b}`} selectedKey={sel ?? undefined}
               onselect={(r, k) => pick(k, coFx(r), compareHref(r.a, r.b))} />
    <DataTable rows={flow} cols={flowCols} caption="어시스트 흐름" sortKey="assists"
               rowKey={(r) => `flow:${r.giver}|${r.taker}`} selectedKey={sel ?? undefined}
               onselect={(r, k) => pick(k, flowFx(r), compareHref(r.giver, r.taker))} />
  </div>
  <p class="note">행을 선택하면 계산 근거가 수식 줄에 보이고, 같은 행을 다시 선택하면 두 멤버 비교 화면으로 이동합니다.</p>
  <div class="pair">
    <DataTable rows={sprees} cols={spreeCols} caption="연속킬" sortKey="streak"
               rowKey={(r) => `spree:${r.name}:${r.champ}:${r.streak}:${r.minute}`} selectedKey={sel ?? undefined}
               onselect={(r, k) => pick(k, spreeFx(r), memberHref(r.name))} />
    <DataTable rows={stops} cols={stopCols} caption="연속킬 저지" sortKey="streak"
               rowKey={(r) => `stop:${r.stopper}|${r.runner}:${r.streak}`} selectedKey={sel ?? undefined}
               onselect={(r, k) => pick(k, stopFx(r), compareHref(r.stopper, r.runner))} />
  </div>
</div>

<style>
  .ties { display: grid; gap: var(--sp-3); min-width: 0; }
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-4);
    align-items: start;
  }
  .note { max-width: 75ch; font-size: var(--fs-sm); color: var(--dim); text-wrap: pretty; }
  @media (max-width: 640px) {
    .pair { grid-template-columns: 1fr; gap: var(--sp-3); }
  }
</style>
