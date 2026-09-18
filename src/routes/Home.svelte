<script lang="ts">
  /**
   * 첫 화면 — 내전 장부의 첫 시트. 위에서부터: 한 줄 메타(경기·멤버·평균 시간·갱신) → 사다리
   * (보기 버튼: 라인별(기본)·통합·라인 하나) → 안내 두 줄 → 티어 계산식(늘 펼침).
   *
   * 행 선택은 수식 줄에 계산 근거를 쓴다(`=티어(CP 1135) → 2티어 85점 · MMR 1185 · 6판`).
   * 같은 행을 다시 선택(클릭·Enter)하면 멤버 화면으로 간다 — 표 셀은 글자만 그리므로 이름 셀에
   * 링크를 넣지 못했다(DataTable 계약). 소환사명 검색 셀도 같은 곳으로 간다.
   * 행 만들기(정렬 밴드·순위·메달·문턱)는 $lib/ladder 의 순수 함수 — 여기서는 열과 서식만.
   */
  import { app } from '$lib/data/store.svelte';
  import { memberHref, router } from '$lib/router.svelte';
  import { announce } from '$lib/a11y';
  import { clearFx, setFx } from '$lib/fx.svelte';
  import { durKo, pct, stampFull, stampShort } from '$lib/fmt';
  import { LANE_SEQ, laneKo } from '$lib/lanes';
  import { cpTiers, minGamesNote, wrClass } from '$lib/tier';
  import { mLabel } from '$lib/metrics';
  import { laneCounts, laneRows, unifiedRows, type LadderRow } from '$lib/ladder';
  import type { Col } from '$lib/table';
  import type { LaneId } from '$lib/data/types';
  import DataTable from '$components/DataTable.svelte';
  import QMark from '$components/Tooltip.svelte';
  import CpFormula from './math/CpFormula.svelte';

  // 홈은 하위 화면이 없다 — 라우터 계약(sub·params)만 받고 쓰지 않는다
  let { sub = '', params = {} }: { sub?: string; params?: Record<string, string> } = $props();

  type View = 'all' | 'one' | LaneId;
  let view = $state<View>('all');
  let selected = $state<string | null>(null);

  const data = $derived(app.data);
  const need = $derived(data?.cp_constants?.placement_games ?? 0);
  const laneNeed = $derived(data?.cp_constants?.lane_prior_k ?? 0);
  const unplaced = $derived(Object.values(data?.cp ?? {}).filter((e) => !e.placed).length);
  const rows = $derived.by((): LadderRow[] => {
    if (!data) return [];
    if (view === 'one') return unifiedRows(data);
    return laneRows(data, app.minGamesLane, view === 'all' ? null : view);
  });
  const counts = $derived(data ? laneCounts(data, app.minGamesLane) : null);
  const note = $derived(minGamesNote(data, view !== 'one'));
  // 배치 안내 — 표의 '배치 n/5' 셀과 선 아래 밴드가 무엇인지 한 문장씩
  const placeNote = $derived.by(() => {
    let s = `배치 ${need}판`;
    if (unplaced) s += ` · ${unplaced}명 배치 진행 중`;
    s += ' · 배치 전에는 티어를 표시하지 않습니다.';
    if (view !== 'one') s += ` 라인 ${laneNeed}판부터 라인 배치 완료, 미완 행은 선 아래에 모입니다.`;
    return s + ' 같은 행을 다시 선택하면 멤버 화면으로 이동합니다.';
  });

  const DASH = '—';
  const BAND: Readonly<Record<LaneId, string>> = { TOP: 'lane-top', JUNGLE: 'lane-jg', MIDDLE: 'lane-mid', BOTTOM: 'lane-bot', UTILITY: 'lane-sup' };
  const laneCls = (l: LaneId | null) => (l ? BAND[l] : '');
  const numOrDash = (v: unknown) => (v == null ? DASH : String(v));
  const tierIdx = (name: string) => cpTiers(data).findIndex((t) => t.name === name) + 1;
  // 승률 채움: WinRate 셀과 같은 규칙(높음 --win · 낮음 --loss · 문턱 미만은 옅은 글자)
  const WR: Readonly<Record<string, string>> = { 'wr-h': 'win', 'wr-l': 'loss', 'wr-dim': 'wr-dim', 'wr-m': '' };
  const wrCls = (r: LadderRow) =>
    r.winrate == null ? '' : WR[wrClass(r.winrate, r.games, view === 'one' ? app.minGames : app.minGamesLane)] ?? '';

  const cols = $derived.by((): Col<LadderRow>[] => {
    const one = view === 'one';
    const meta = data?.metric_meta;
    const out: Col<LadderRow>[] = [
      { k: 'name', h: '멤버' },
      { k: 'rank', h: '순위', num: true, nullLast: true, fmt: numOrDash, cls: (r) => r.medal?.cls ?? '' },
      { k: 'laneOrd', h: one ? '주 라인' : '라인', nullLast: true,
        fmt: (_v, r) => laneKo(r.lane) + (!one && r.main ? ' · 주' : ''), cls: (r) => laneCls(r.lane) },
      { k: 'tierIdx', h: '티어', nullLast: true,
        fmt: (_v, r) => (r.placed ? r.tier : `배치 ${r.games}/${need}`),
        cls: (r) => (r.placed ? `t${tierIdx(r.tier)}` : 'pend') },
      { k: 'cp', h: 'CP', num: true, nullLast: true, hlp: 'CP', fmt: numOrDash },
      { k: 'points', h: '점수', num: true, bar: true, nullLast: true, lo: true, fmt: numOrDash },
    ];
    if (one) out.push({ k: 'toNext', h: '승급까지', num: true, nullLast: true, lo: true, fmt: numOrDash });
    out.push(
      { k: 'mmr', h: one ? 'MMR' : '라인 MMR', num: true, nullLast: true, lo: one, hlp: one ? 'MMR' : '라인MMR',
        fmt: numOrDash, cls: (r) => (r.placed && !r.lanePlaced ? 'pend' : '') },
      { k: 'games', h: '판', num: true,
        fmt: (_v, r) => (r.placed && !r.lanePlaced ? `배치 ${r.games}/${laneNeed}` : String(r.games)) },
      { k: 'winrate', h: mLabel(meta, 'winrate'), num: true, nullLast: true,
        fmt: (v) => (v == null ? DASH : pct(v as number)), cls: wrCls },
    );
    return out;
  });
  const LOWER = ['rank', 'laneOrd', 'tierIdx'];

  const VIEW_LABEL: Readonly<Record<'all' | 'one', string>> = { all: '라인별', one: '통합' };
  const viewLabel = (v: View) => (v === 'all' || v === 'one' ? VIEW_LABEL[v] : laneKo(v));
  const caption = $derived(`사다리 · ${viewLabel(view)}`);

  function setView(v: View) {
    if (view === v) return;
    view = v;
    selected = null;
    clearFx();
    announce(`${viewLabel(v)} 사다리`);
  }

  /** 수식 줄 — 선택한 행의 계산 근거. 배치 전에는 티어 대신 배치 진행만 적는다 */
  function fxFor(r: LadderRow): string {
    if (!r.placed) return `=배치(${r.games}/${need}판) → 티어 산정 전`;
    const lane = r.lane && view !== 'one' ? `${laneKo(r.lane)} ` : '';
    const pending = r.lanePlaced ? '' : ` (라인 배치 ${r.games}/${laneNeed})`;
    return `=티어(CP ${r.cp}) → ${r.tier} ${r.points}점 · ${lane}MMR ${r.mmr} · ${lane}${r.games}판${pending}`;
  }
  function onselect(r: LadderRow, key: string) {
    if (selected === key) { router.go(memberHref(r.name)); return; }
    selected = key;
    setFx(fxFor(r));
  }
</script>

{#if data}
  <section class="home" aria-labelledby="home-h">
    <h2 id="home-h" class="sr-only">사다리</h2>
    <p class="meta">
      <span>{data.summary.total_games}경기</span> · <span>{data.summary.player_count}명</span>
      · <span>평균 {durKo(data.summary.avg_duration_sec)}</span>
      · <time datetime={data.timestamp} title={stampFull(data.timestamp)}>갱신 {stampShort(data.timestamp)}</time>
    </p>

    <div class="views" role="group" aria-label="사다리 보기">
      <button type="button" class="vb" aria-pressed={view === 'all'} onclick={() => setView('all')}>라인별</button>
      <button type="button" class="vb" aria-pressed={view === 'one'} onclick={() => setView('one')}>통합</button>
      {#each LANE_SEQ as l (l)}
        <button type="button" class="vb {BAND[l]}" aria-pressed={view === l} onclick={() => setView(l)}>
          {laneKo(l)} <span class="n">{counts?.[l] ?? 0}</span>
        </button>
      {/each}
    </div>

    <div class="ladder">
      {#key view}
        <DataTable {rows} {cols} {caption} sortKey="rank" sortDir={1} lowerBetterKeys={LOWER}
                   rowKey={(r) => r.key} selectedKey={selected ?? undefined} {onselect}
                   rowClass={(r) => (r.unp ? 'unp' : '')} filter={false} />
      {/key}
    </div>

    <p class="note">{placeNote}</p>
    {#if note}
      <p class="note">{note.text} <QMark text={note.tip} label={note.tipLabel} /></p>
    {/if}

    <CpFormula {data} />
  </section>
{/if}

<style>
  .home { display: flex; flex-direction: column; gap: var(--sp-3); }

  /* 한 줄 메타 — 무채색, 큰 숫자 타일 없음 */
  .meta { color: var(--dim); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
  .meta time { color: var(--dim); }

  /* 보기 버튼 — 라인 칩 모양(왼쪽 3px 띠)의 작은 버튼. 눌린 것은 선택색 테두리 */
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

  /* 사다리 — 표 안 조건부 서식은 DataTable 의 클래스(t1~t5·pend·lane-*·win·loss). 여기 것만 덧댄다 */
  .ladder :global(tr.unp td:not(.rn)) { color: var(--dim); }
  /* 배치 미완 밴드 앞 구분선 — 마지막 배치 완료 행의 아래 선을 굵게 */
  .ladder :global(tr:not(.unp):has(+ tr.unp) td) { border-bottom: 2px solid var(--grid-strong); }
  .ladder :global(td.medal) { font-weight: 650; color: var(--txt); }
  .ladder :global(td.m1) { border-left: 3px solid var(--t1); }
  .ladder :global(td.m2) { border-left: 3px solid var(--dim2); }
  .ladder :global(td.m3) { border-left: 3px solid var(--t4); }
  .ladder :global(td.wr-dim) { color: var(--dim); }

  .note { max-width: 75ch; color: var(--dim); font-size: var(--fs-sm); text-wrap: pretty; }

  @media (pointer: coarse) {
    .vb { min-height: 44px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .vb { transition: none; }
  }
</style>
