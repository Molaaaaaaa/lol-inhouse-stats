<script lang="ts">
  /**
   * 기록 · 명예의 전당 — 이름 있는 범위 넷: 경기 기록(최단·최장·최다 킬·평균 킬) · 개인 기록(records 사전) ·
   * MVP · 펜타킬. 옛 KPI 카드 격자(renderRecords)를 표로 옮겼다 — 기록 하나가 한 행이다.
   *
   * 행 선택은 수식 줄에 근거를 쓰고(`=최고 KDA 28 · 외 걸 · 아리 14/1/14 · 승 · 30:04 · 9. 3.`),
   * 같은 행을 다시 선택하면 그 멤버 화면으로 간다(사다리와 같은 규칙). 경기 기록은 갈 곳이 없어 선택이 없다 —
   * 매치 ID 는 익명화 원칙상 발행물에 없다.
   */
  import type { GuildPayload, MvpRow } from '$lib/data/types';
  import { dateKo, mmss, num, pct } from '$lib/fmt';
  import { setFx } from '$lib/fx.svelte';
  import { hallFx, hallRows, mvpNote, pentaRows, serverRows, type HallRow, type PentaRow, type ServerRow } from '$lib/records';
  import { memberHref, router } from '$lib/router.svelte';
  import type { Col } from '$lib/table';
  import { minGamesNote } from '$lib/tier';
  import DataTable from '$components/DataTable.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import QMark from '$components/Tooltip.svelte';

  let { data }: { data: GuildPayload } = $props();

  const champKo = (id: string) => data.champ_ko?.[id] ?? id;
  const minGames = $derived(data.min_games || 5);

  const server = $derived(serverRows(data.server_records, data.summary?.total_games));
  const serverCols: Col<ServerRow>[] = [
    { k: 'label', h: '기록', sortable: false },
    { k: 'dur', h: '시간', num: true, sortable: false, fmt: (_v, r) => r.time },
    { k: 'kills', h: '킬', num: true, sortable: false, fmt: (v) => num(v as number) },
    { k: 'ts', h: '시각', sortable: false, fmt: (_v, r) => r.when },
  ];

  const hall = $derived(hallRows(data.records, champKo));
  const hallCols: Col<HallRow>[] = [
    { k: 'label', h: '기록', sortable: false },
    { k: 'name', h: '멤버' },
    { k: 'valueNum', h: '값', num: true, nullLast: true, fmt: (_v, r) => r.value },
    { k: 'champKo', h: '챔피언', img: (r) => r.champ || null },
    { k: 'kdaText', h: 'KDA', num: true, sortable: false, lo: true },
    { k: 'win', h: '결과', nullLast: true, fmt: (v) => (v == null ? '' : v ? '승' : '패'), cls: (r) => (r.win == null ? '' : r.win ? 'win' : 'loss') },
    { k: 'dur', h: '시간', num: true, nullLast: true, lo: true, fmt: (v) => (v == null ? '' : mmss(v as number)) },
    { k: 'ts', h: '시각', nullLast: true, lo: true, fmt: (v) => (v == null ? '' : dateKo(v as number)) },
  ];

  const mvp = $derived<MvpRow[]>(data.mvp ?? []);
  const mvpCols: Col<MvpRow>[] = [
    { k: 'name', h: '멤버' },
    { k: 'mvp', h: 'MVP', num: true, bar: true, hlp: 'MVP' },
    { k: 'games', h: '판', num: true },
  ];
  const mvpText = $derived(mvpNote(data.mvp, data.mvp_excluded, minGames));

  const pentas = $derived(pentaRows(data.records, champKo));
  const pentaCols: Col<PentaRow>[] = [
    { k: 'name', h: '멤버' },
    { k: 'champKo', h: '챔피언', img: (r) => r.champ || null },
  ];

  const note = $derived(minGamesNote(data));

  // 선택 — 패널에 하나. 표마다 키에 접두를 붙여 다른 표의 같은 이름과 겹치지 않는다
  let sel = $state<string | null>(null);
  function pick(key: string, fx: string, dest: string) {
    if (sel === key) { router.go(dest); return; }
    sel = key;
    setFx(fx);
  }
  const hallKey = (r: HallRow) => `rec:${r.key}`;
  const mvpKey = (r: MvpRow) => `mvp:${r.name}`;
  const pentaKey = (r: PentaRow) => `penta:${r.key}`;
  const mvpFx = (r: MvpRow) => `=MVP ${r.mvp}회 ÷ ${r.games}판 = ${r.games ? pct(r.mvp / r.games) : '-'}`;
</script>

<div class="hall">
  <DataTable rows={server} cols={serverCols} caption="경기 기록" filter={false} fold={false} />

  <!-- rows2: 390px 에서 444px(실측) — 폰은 2줄 장부 행 -->
  <DataTable rows={hall} cols={hallCols} caption="개인 기록" filter={false} fold={false} rows2
             rowKey={hallKey} selectedKey={sel ?? undefined}
             onselect={(r, k) => pick(k, hallFx(r), memberHref(r.name))} />
  <p class="note">
    행을 선택하면 계산 근거가 수식 줄에 보이고, 같은 행을 다시 선택하면 멤버 화면으로 이동합니다.
    {#if note}{note.text} <QMark text={note.tip} label={note.tipLabel} />{/if}
  </p>

  <div class="pair">
    <div class="col">
      <DataTable rows={mvp} cols={mvpCols} caption="MVP" sortKey="mvp"
                 rowKey={mvpKey} selectedKey={sel ?? undefined}
                 onselect={(r, k) => pick(k, mvpFx(r), memberHref(r.name))} />
      {#if mvpText}<p class="note">{mvpText}</p>{/if}
    </div>
    <div class="col">
      {#if pentas.length === 0}
        <div class="cap">펜타킬</div>
        <EmptyState text="아직 펜타킬이 없습니다." />
      {:else}
        <DataTable rows={pentas} cols={pentaCols} caption="펜타킬" filter={false} fold={false}
                   rowKey={pentaKey} selectedKey={sel ?? undefined}
                   onselect={(r, k) => pick(k, `=펜타킬 · ${r.name} · ${r.champKo}`, memberHref(r.name))} />
      {/if}
    </div>
  </div>
</div>

<style>
  .hall { display: grid; gap: var(--sp-3); min-width: 0; }
  /* minmax(0, …): 표가 열보다 넓으면 격자 항목이 늘어나 문서가 넘친다 — 0 으로 잡아 표 안에서만 스크롤 */
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-4);
    align-items: start;
  }
  .col { display: grid; gap: var(--sp-2); min-width: 0; }
  .cap {
    font-size: var(--fs-sm); font-weight: 700;
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  .note { max-width: 75ch; font-size: var(--fs-sm); color: var(--dim); text-wrap: pretty; }
  @media (max-width: 640px) {
    .pair { grid-template-columns: 1fr; gap: var(--sp-3); }
  }
</style>
