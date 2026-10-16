<script lang="ts">
  /**
   * 기록 · 명예의 전당 — 카드(Panel) 넷: 경기 기록(최단·최장·최다 킬·평균 킬) · 개인 기록(records 사전) ·
   * MVP · 펜타킬. 경기 기록과 개인 기록은 기록 하나가 기록 카드 하나다(이름 · 큰 값 · 멤버 · 챔피언 · 날짜).
   *
   * 개인 기록 카드는 누를 수 있다: 선택하면 수식 줄에 근거(`=최고 KDA 28 · 외 걸 · 아리 14/1/14 · 승 · 30:04 · 9. 3.`),
   * 같은 카드를 다시 선택하면 그 멤버 화면으로 간다(멤버 시트(홈)와 같은 규칙). 선택된 카드는 글로우.
   * 경기 기록은 갈 곳이 없어 누를 수 없다 — 매치 ID 는 익명화 원칙상 발행물에 없다.
   */
  import type { GuildPayload, MvpRow } from '$lib/data/types';
  import { dateKo, mmss, pct } from '$lib/fmt';
  import { setFx } from '$lib/fx.svelte';
  import { hallFx, hallRows, mvpNote, pentaRows, serverCard, serverRows, type HallRow, type PentaRow } from '$lib/records';
  import { memberHref, router } from '$lib/router.svelte';
  import type { Col } from '$lib/table';
  import { minGamesNote } from '$lib/tier';
  import ChampImg from '$components/ChampImg.svelte';
  import DataTable from '$components/DataTable.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import Panel from '$components/Panel.svelte';
  import QMark from '$components/Tooltip.svelte';

  let { data }: { data: GuildPayload } = $props();

  const champKo = (id: string) => data.champ_ko?.[id] ?? id;
  const minGames = $derived(data.min_games || 5);
  const patch = $derived(data.patch);

  const server = $derived(serverRows(data.server_records, data.summary?.total_games));
  const hall = $derived(hallRows(data.records, champKo));

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

  // 선택 — 화면에 하나. 표·카드마다 키에 접두를 붙여 다른 곳의 같은 이름과 겹치지 않는다
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
  <Panel title="경기 기록" level={3}>
    {#if server.length === 0}
      <EmptyState text="아직 표시할 데이터가 없습니다." />
    {:else}
      <ul class="recs">
        {#each server as r (r.key)}
          {@const c = serverCard(r)}
          <li class="rc tile">
            <span class="k">{r.label}</span>
            <span class="v">{c.value}{#if c.unit}<span class="u">{c.unit}</span>{/if}</span>
            {#if c.sub}<span class="m">{c.sub}</span>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Panel>

  <Panel title="개인 기록" level={3}>
    {#if hall.length === 0}
      <EmptyState text="아직 표시할 데이터가 없습니다." />
    {:else}
      <ul class="recs">
        {#each hall as r (r.key)}
          {@const key = hallKey(r)}
          {@const on = sel === key}
          <li>
            <button type="button" class={['rc', 'tile', on ? 'glow' : 'lift']} aria-pressed={on}
                    onclick={() => pick(key, hallFx(r), memberHref(r.name))}>
              <span class="k">{r.label}</span>
              <span class="v">{r.value}</span>
              <span class="who">{#if r.champ}<ChampImg name={r.champ} {patch} size={24} />{/if}<span class="nm">{r.name}</span></span>
              <span class="m">
                {#if r.champKo || r.kdaText}<span>{[r.champKo, r.kdaText].filter(Boolean).join(' ')}</span>{/if}
                {#if r.win != null}<span class={['tag', r.win ? 'win' : 'loss']}>{r.win ? '승' : '패'}</span>{/if}
                {#if r.dur}<span>{mmss(r.dur)}</span>{/if}
                {#if r.ts}<span>{dateKo(r.ts)}</span>{/if}
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    <p class="note">
      기록 카드를 선택하면 계산 근거가 수식 줄에 보이고, 같은 카드를 다시 선택하면 멤버 화면으로 이동합니다.
      {#if note}{note.text} <QMark text={note.tip} label={note.tipLabel} />{/if}
    </p>
  </Panel>

  <div class="pair">
    <Panel title="MVP" level={3}>
      <DataTable rows={mvp} cols={mvpCols} caption="MVP" captionHidden sortKey="mvp"
                 rowKey={mvpKey} selectedKey={sel ?? undefined}
                 onselect={(r, k) => pick(k, mvpFx(r), memberHref(r.name))} />
      {#if mvpText}<p class="note">{mvpText}</p>{/if}
    </Panel>
    <Panel title="펜타킬" level={3}>
      {#if pentas.length === 0}
        <EmptyState text="아직 펜타킬이 없습니다." />
      {:else}
        <DataTable rows={pentas} cols={pentaCols} caption="펜타킬" captionHidden filter={false} fold={false}
                   rowKey={pentaKey} selectedKey={sel ?? undefined}
                   onselect={(r, k) => pick(k, `=펜타킬 · ${r.name} · ${r.champKo}`, memberHref(r.name))} />
      {/if}
    </Panel>
  </div>
</div>

<style>
  .hall { display: grid; gap: var(--sp-4); min-width: 0; }
  /* minmax(0, …): 표가 열보다 넓으면 격자 항목이 늘어나 문서가 넘친다 — 0 으로 잡아 표 안에서만 스크롤 */
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-4);
    align-items: start;
  }

  /* 기록 카드 격자 — 안쪽 판(.tile, 12px). 이름(12px) · 큰 값(16px/700) · 멤버 · 사실 한 줄 */
  .recs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .recs > li { display: grid; min-width: 0; }
  .rc {
    display: grid;
    align-content: start;
    gap: 3px;
    min-width: 0;
    padding: 10px var(--sp-3) var(--sp-3);
    color: var(--txt);
    text-align: left;
    font: inherit;
  }
  button.rc { cursor: pointer; }
  .k { font-size: var(--fs-xs); color: var(--dim); }
  .v { font-size: var(--fs-lg); font-weight: 700; line-height: 1.3; font-variant-numeric: tabular-nums; }
  .u { margin-left: 2px; font-size: var(--fs-sm); font-weight: 400; color: var(--dim); }
  .who { display: flex; align-items: center; gap: 6px; min-width: 0; margin-top: var(--sp-1); }
  .who :global(.champ) { border-radius: var(--r-xs); }
  .nm { min-width: 0; font-weight: 700; overflow-wrap: anywhere; }
  .m {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px var(--sp-2);
    font-size: var(--fs-sm);
    color: var(--dim);
    font-variant-numeric: tabular-nums;
  }
  .tag {
    display: inline-grid;
    place-items: center;
    min-width: 22px;
    height: 20px;
    padding: 0 5px;
    border-radius: var(--r-xs);
    font-size: var(--fs-xs);
    font-weight: 700;
    line-height: 1;
  }
  .tag.win { background: color-mix(in srgb, var(--win) 20%, transparent); color: var(--win-soft); }
  .tag.loss { background: color-mix(in srgb, var(--loss) 16%, transparent); color: var(--loss-soft); }

  .note { max-width: 75ch; padding-top: var(--sp-3); font-size: var(--fs-sm); color: var(--dim); text-wrap: pretty; }
  .pair .note { padding-top: var(--sp-2); }
  @media (max-width: 640px) {
    .hall { gap: var(--sp-3); }
    .pair { grid-template-columns: 1fr; gap: var(--sp-3); }
    .recs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-2); }
    .rc { padding: var(--sp-2) 10px 10px; }
  }
  @media (forced-colors: active) {
    .tag { border: 1px solid CanvasText; }
    button.rc[aria-pressed='true'] { outline: 2px solid Highlight; }
  }
</style>
