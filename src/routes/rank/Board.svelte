<script lang="ts">
  /**
   * 승률 리더보드 — 보기 버튼 줄(라인별(기본) · 통합 · 라인 하나, 사다리와 같은 모양) → 격자 표 → 안내 두 줄.
   * 보기는 URL(`#/rank/board/:lane?` — 없음=라인별 · all=통합 · 라인 키)이 상태다.
   *
   * 통합은 payload 의 leaderboard(발행 문턱, 신뢰성 ci_lower 순), 라인별은 players[*].lanes(라인 판수 ≥ 라인 문턱).
   * 순위·메달은 기본 순서(신뢰성) 기준으로 $lib/rank 가 미리 박는다 — 표를 다른 열로 정렬해도 1위는 1위다.
   * 행 선택은 수식 줄에 `=승률(6/6) → 100% · 신뢰성 61%`, 같은 행을 다시 선택하면 멤버 화면(표 셀은 글자만 — DataTable 계약).
   */
  import { app } from '$lib/data/store.svelte';
  import { href, memberHref, router } from '$lib/router.svelte';
  import { announce } from '$lib/a11y';
  import { clearFx, setFx } from '$lib/fx.svelte';
  import { pct } from '$lib/fmt';
  import { LANE_SEQ, laneKo } from '$lib/lanes';
  import { minGamesNote } from '$lib/tier';
  import { mLabel } from '$lib/metrics';
  import { laneCls, wrCls } from '$lib/member';
  import { boardLaneCounts, boardRows, boardViewOf, type BoardRow, type BoardView } from '$lib/rank';
  import type { Col } from '$lib/table';
  import type { LaneId } from '$lib/data/types';
  import DataTable from '$components/DataTable.svelte';
  import QMark from '$components/Tooltip.svelte';
  import Skeleton from '$components/Skeleton.svelte';

  let { params = {} }: { params?: Record<string, string> } = $props();

  const data = $derived(app.data);
  const view = $derived(boardViewOf(params.lane));
  const rows = $derived(data ? boardRows(data, view, app.minGamesLane) : []);
  const counts = $derived(data ? boardLaneCounts(data, app.minGamesLane) : null);
  const note = $derived(minGamesNote(data, view !== 'all'));
  const need = $derived(view === 'all' ? app.minGames : app.minGamesLane);

  let selected = $state<string | null>(null);
  // 보기가 바뀌면(버튼·뒤로 가기 모두 URL 로 온다) 선택과 수식 줄을 비운다 — 지난 표의 근거가 남지 않게
  $effect(() => {
    void view;
    selected = null;
    clearFx();
  });

  const DASH = '—';
  const numOrDash = (v: unknown) => (v == null ? DASH : String(v));
  const intOrDash = (v: unknown) => (v == null ? DASH : Math.round(Number(v)).toLocaleString('ko-KR'));
  const pctOrDash = (v: unknown) => (v == null ? DASH : pct(Number(v)));

  const cols = $derived.by((): Col<BoardRow>[] => {
    const meta = data?.metric_meta;
    const all = view === 'all';
    const out: Col<BoardRow>[] = [
      { k: 'name', h: '멤버' },
      { k: 'rank', h: '순위', num: true, nullLast: true, fmt: numOrDash, cls: (r) => r.medal?.cls ?? '' },
    ];
    if (view === 'lanes') out.push({ k: 'laneOrd', h: '라인', fmt: (_v, r) => laneKo(r.lane), cls: (r) => laneCls(r.lane) });
    out.push(
      { k: 'games', h: '판', num: true },
      { k: 'wins', h: '승', num: true },
      { k: 'losses', h: '패', num: true, lo: true },
      { k: 'winrate', h: mLabel(meta, 'winrate'), num: true, fmt: pctOrDash, cls: (r) => wrCls(r.winrate, r.games, need) },
      { k: 'ci', h: '신뢰성', num: true, lo: true, hlp: '신뢰성', fmt: pctOrDash },
      { k: 'kda', h: mLabel(meta, 'kda'), num: true, lo: true, fmt: numOrDash },
      { k: 'kp', h: mLabel(meta, 'kp'), num: true, lo: true, fmt: pctOrDash },
      { k: 'dpm', h: mLabel(meta, 'dpm'), num: true, bar: true, lo: true, fmt: intOrDash },
    );
    if (!all) {
      out.push(
        { k: 'cs', h: '판당 CS', num: true, lo: true, fmt: intOrDash },
        { k: 'vision', h: mLabel(meta, 'vision'), num: true, lo: true, fmt: intOrDash },
      );
    }
    return out;
  });
  const LOWER = ['rank', 'laneOrd'];

  const BAND: Readonly<Record<LaneId, string>> = { TOP: 'lane-top', JUNGLE: 'lane-jg', MIDDLE: 'lane-mid', BOTTOM: 'lane-bot', UTILITY: 'lane-sup' };
  const VIEW_LABEL: Readonly<Record<'lanes' | 'all', string>> = { lanes: '라인별', all: '통합' };
  const viewLabel = (v: BoardView) => (v === 'lanes' || v === 'all' ? VIEW_LABEL[v] : laneKo(v));
  const caption = $derived(`승률 리더보드 · ${viewLabel(view)}`);
  const hrefOf = (v: BoardView) => (v === 'lanes' ? href(['rank', 'board']) : href(['rank', 'board', v]));

  function setView(v: BoardView) {
    if (view === v) return;
    announce(`${viewLabel(v)} 리더보드`);
    router.go(hrefOf(v));
  }

  // 표 아래 한 문장 — 이 표에 누가 몇 줄 있고, 순위가 무엇 기준인지
  const scopeNote = $derived.by(() => {
    const n = rows.length;
    const head = view === 'lanes'
      ? `멤버 × 라인 ${n}줄 · 라인 ${app.minGamesLane}판 이상`
      : view === 'all'
        ? `${n}명 · 전체 경기 기준`
        : `${laneKo(view)} ${app.minGamesLane}판 이상 출전한 ${n}명 · ${laneKo(view)} 경기만 집계`;
    return `${head}. 순위는 신뢰성(승률의 Wilson 하한) 기준입니다. 같은 행을 다시 선택하면 멤버 화면으로 이동합니다.`;
  });

  /** 수식 줄 — 승률의 계산 근거. 라인별 행은 어느 라인 판인지 같이 적는다 */
  function fxFor(r: BoardRow): string {
    const lane = r.lane ? `${laneKo(r.lane)} ` : '';
    return `=승률(${lane}${r.wins}/${r.games}) → ${pct(r.winrate)} · 신뢰성 ${pct(r.ci)}`;
  }
  function onselect(r: BoardRow, key: string) {
    if (selected === key) { router.go(memberHref(r.name)); return; }
    selected = key;
    setFx(fxFor(r));
  }
</script>

{#if data}
  <div class="board">
    <div class="views" role="group" aria-label="리더보드 보기">
      <button type="button" class="vb" aria-pressed={view === 'lanes'} onclick={() => setView('lanes')}>라인별</button>
      <button type="button" class="vb" aria-pressed={view === 'all'} onclick={() => setView('all')}>통합</button>
      {#each LANE_SEQ as l (l)}
        <button type="button" class="vb {BAND[l]}" aria-pressed={view === l} onclick={() => setView(l)}>
          {laneKo(l)} <span class="n">{counts?.[l] ?? 0}</span>
        </button>
      {/each}
    </div>

    <div class="sheet">
      {#key view}
        <DataTable {rows} {cols} {caption} sortKey="rank" sortDir={1} lowerBetterKeys={LOWER}
                   rowKey={(r) => r.key} selectedKey={selected ?? undefined} {onselect} />
      {/key}
    </div>

    <p class="note">{scopeNote}</p>
    {#if note}
      <p class="note">{note.text} <QMark text={note.tip} label={note.tipLabel} /></p>
    {/if}
  </div>
{:else}
  <Skeleton rows={8} />
{/if}

<style>
  .board { display: flex; flex-direction: column; gap: var(--sp-3); }

  /* 보기 버튼 — 사다리(홈)와 같은 어휘: 라인 칩 모양(왼쪽 3px 띠)의 작은 버튼, 눌린 것은 선택색 테두리 */
  .views { display: flex; flex-wrap: wrap; gap: var(--sp-1); }
  .vb {
    min-height: 28px;
    padding: 0 var(--sp-2);
    background: var(--sheet);
    color: var(--dim);
    border: 1px solid var(--grid-strong);
    border-left-width: 3px;
    border-left-color: transparent;
    border-radius: var(--r-chip);
    font-size: var(--fs-sm);
    line-height: 1.6;
    white-space: nowrap;
    transition: background-color .15s ease-out, color .15s ease-out, border-color .15s ease-out;
  }
  .vb:hover { background: var(--raised); color: var(--txt); }
  .vb:active { background: var(--gutter); }
  .vb:disabled { color: var(--dim2); border-color: var(--grid); cursor: default; }
  .vb[aria-pressed='true'] { background: var(--raised); color: var(--txt); border-color: var(--sel); }
  .vb.lane-top { border-left-color: var(--lane-top); }
  .vb.lane-jg { border-left-color: var(--lane-jg); }
  .vb.lane-mid { border-left-color: var(--lane-mid); }
  .vb.lane-bot { border-left-color: var(--lane-bot); }
  .vb.lane-sup { border-left-color: var(--lane-sup); }
  .vb .n { font-variant-numeric: tabular-nums; }

  /* 메달 — 순위 셀 왼쪽 띠(사다리와 같은 모양). 승·패 채움은 DataTable 의 win/loss */
  .sheet :global(td.medal) { font-weight: 650; color: var(--txt); }
  .sheet :global(td.m1) { border-left: 3px solid var(--t1); }
  .sheet :global(td.m2) { border-left: 3px solid var(--dim2); }
  .sheet :global(td.m3) { border-left: 3px solid var(--t4); }

  .note { max-width: 75ch; color: var(--dim); font-size: var(--fs-sm); text-wrap: pretty; }

  @media (pointer: coarse) {
    .vb { min-height: 44px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .vb { transition: none; }
  }
</style>
