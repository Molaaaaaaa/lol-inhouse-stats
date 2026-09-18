<script lang="ts">
  /**
   * 첫 화면 — 내전 장부의 첫 시트. 위에서부터: 한 줄 메타(평균 시간·갱신 — 경기·멤버 수는 헤더에
   * 이미 있다) → 보기 버튼 둘(라인별(기본)·통합) → 사다리 → 안내 두 줄 → '티어 계산식 →' 링크.
   * 라인 하나만 보는 것은 표 머리 '라인' 열의 드롭다운(DataTable 의 Col.pick)이다 — 라인별 보기에서만.
   *
   * 행 선택은 수식 줄에 계산 근거를 쓴다(`=티어(CP 1135) → 2티어 85점 · MMR 1185 · 6판`).
   * 같은 행을 다시 선택(클릭·Enter)하면 멤버 화면으로 간다 — 표 셀은 글자만 그리므로 이름 셀에
   * 링크를 넣지 못했다(DataTable 계약). 소환사명 검색 셀도 같은 곳으로 간다.
   * 행 만들기(정렬 밴드·순위·메달·문턱)는 $lib/ladder 의 순수 함수 — 여기서는 열과 서식만.
   *
   * 폰(≤640px): '순위' 열을 숨긴다 — 기본 정렬이 순위라 행 번호 홈통이 곧 순위다(상위 3 은 홈통 숫자
   * 굵게). 그래서 폰에서는 sortKey 를 주지 않는다(들어온 순서 = 순위 순서, 순위 열은 lo 로 숨는다).
   * 라인 셀은 띠 + 짧은 글자만(' · 주' 생략), 라인 MMR 머리는 'MMR'(물음표가 라인 MMR 임을 설명한다).
   */
  import { app } from '$lib/data/store.svelte';
  import { href, memberHref, router } from '$lib/router.svelte';
  import { announce } from '$lib/a11y';
  import { clearFx, setFx } from '$lib/fx.svelte';
  import { media } from '$lib/media.svelte';
  import { durKo, pct, stampFull, stampShort } from '$lib/fmt';
  import { LANE_SEQ, laneKo } from '$lib/lanes';
  import { cpTiers, minGamesNote, wrClass } from '$lib/tier';
  import { mLabel } from '$lib/metrics';
  import { laneCounts, laneRows, unifiedRows, type LadderRow } from '$lib/ladder';
  import type { Col, ColPick } from '$lib/table';
  import type { LaneId } from '$lib/data/types';
  import DataTable from '$components/DataTable.svelte';
  import QMark from '$components/Tooltip.svelte';

  // 홈은 하위 화면이 없다 — 라우터 계약(sub·params)만 받고 쓰지 않는다
  let { sub = '', params = {} }: { sub?: string; params?: Record<string, string> } = $props();

  type Mode = 'all' | 'one';
  let mode = $state<Mode>('all');
  /** 라인별 보기에서 고른 라인 — '' 은 전체 */
  let lane = $state<LaneId | ''>('');
  let selected = $state<string | null>(null);

  const data = $derived(app.data);
  const phone = $derived(media.phone);
  const need = $derived(data?.cp_constants?.placement_games ?? 0);
  const laneNeed = $derived(data?.cp_constants?.lane_prior_k ?? 0);
  const unplaced = $derived(Object.values(data?.cp ?? {}).filter((e) => !e.placed).length);
  const rows = $derived.by((): LadderRow[] => {
    if (!data) return [];
    if (mode === 'one') return unifiedRows(data);
    return laneRows(data, app.minGamesLane, lane || null);
  });
  const counts = $derived(data ? laneCounts(data, app.minGamesLane) : null);
  const note = $derived(minGamesNote(data, mode !== 'one'));
  // 배치 안내 — 표의 '배치 n/5' 셀과 선 아래 밴드가 무엇인지 한 문장씩
  const placeNote = $derived.by(() => {
    let s = `배치 ${need}판`;
    if (unplaced) s += ` · ${unplaced}명 배치 진행 중`;
    s += ' · 배치 전에는 티어를 표시하지 않습니다.';
    if (mode !== 'one') s += ` 라인 ${laneNeed}판부터 라인 배치 완료, 미완 행은 선 아래에 모입니다.`;
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
    r.winrate == null ? '' : WR[wrClass(r.winrate, r.games, mode === 'one' ? app.minGames : app.minGamesLane)] ?? '';

  /** 표 머리 '라인' 열의 드롭다운 — 전체 + 라인 다섯(그 라인 표의 행 수). 라인별 보기에서만 */
  const lanePick = $derived.by((): ColPick => ({
    value: lane,
    label: '라인 선택',
    options: [
      { v: '', label: '전체' },
      ...LANE_SEQ.map((l) => ({ v: l, label: `${laneKo(l)} ${counts?.[l] ?? 0}` })),
    ],
    onchange: setLane,
  }));

  const cols = $derived.by((): Col<LadderRow>[] => {
    const one = mode === 'one';
    const meta = data?.metric_meta;
    const out: Col<LadderRow>[] = [
      { k: 'name', h: '멤버' },
      { k: 'rank', h: '순위', num: true, nullLast: true, lo: true, fmt: numOrDash, cls: (r) => r.medal?.cls ?? '' },
      { k: 'laneOrd', h: one ? '주 라인' : '라인', nullLast: true, pick: one ? undefined : lanePick,
        fmt: (_v, r) => laneKo(r.lane) + (!one && !phone && r.main ? ' · 주' : ''), cls: (r) => laneCls(r.lane) },
      { k: 'tierIdx', h: '티어', nullLast: true,
        fmt: (_v, r) => (r.placed ? r.tier : `배치 ${r.games}/${need}`),
        cls: (r) => (r.placed ? `t${tierIdx(r.tier)}` : 'pend') },
      { k: 'cp', h: 'CP', num: true, nullLast: true, hlp: 'CP', fmt: numOrDash },
      { k: 'points', h: '점수', num: true, bar: true, nullLast: true, lo: true, fmt: numOrDash },
    ];
    if (one) out.push({ k: 'toNext', h: '승급까지', num: true, nullLast: true, lo: true, fmt: numOrDash });
    out.push(
      { k: 'mmr', h: one || phone ? 'MMR' : '라인 MMR', num: true, nullLast: true, lo: one, hlp: one ? 'MMR' : '라인MMR',
        fmt: numOrDash, cls: (r) => (r.placed && !r.lanePlaced ? 'pend' : '') },
      { k: 'games', h: '판', num: true,
        fmt: (_v, r) => (r.placed && !r.lanePlaced ? `배치 ${r.games}/${laneNeed}` : String(r.games)) },
      { k: 'winrate', h: mLabel(meta, 'winrate'), num: true, nullLast: true,
        fmt: (v) => (v == null ? DASH : pct(v as number)), cls: wrCls },
    );
    return out;
  });
  const LOWER = ['rank', 'laneOrd', 'tierIdx'];
  /** 폰에서는 순위 열이 숨으므로 정렬 기준을 두지 않는다 — ladder 가 준 순서가 곧 순위다 */
  const sortKey = $derived(phone ? undefined : 'rank');
  /** 행 클래스 — 선 아래 밴드(unp) + 상위 3(medal m1~m3: 홈통 숫자 굵게) */
  const rowClass = (r: LadderRow) => [r.unp && 'unp', r.medal?.cls].filter(Boolean).join(' ');

  const MODE_LABEL: Readonly<Record<Mode, string>> = { all: '라인별', one: '통합' };
  const caption = $derived(`사다리 · ${mode === 'one' ? MODE_LABEL.one : lane ? laneKo(lane) : MODE_LABEL.all}`);

  function setMode(m: Mode) {
    if (mode === m) return;
    mode = m;
    selected = null;
    clearFx();
    announce(`${MODE_LABEL[m]} 사다리`);
  }
  function setLane(v: string) {
    const l = (LANE_SEQ as readonly string[]).includes(v) ? (v as LaneId) : '';
    if (lane === l) return;
    lane = l;
    selected = null;
    clearFx();
    announce(l ? `${laneKo(l)} 사다리` : '라인 전체 사다리');
  }

  /** 수식 줄 — 선택한 행의 계산 근거. 배치 전에는 티어 대신 배치 진행만 적는다 */
  function fxFor(r: LadderRow): string {
    if (!r.placed) return `=배치(${r.games}/${need}판) → 티어 산정 전`;
    const ln = r.lane && mode !== 'one' ? `${laneKo(r.lane)} ` : '';
    const pending = r.lanePlaced ? '' : ` (라인 배치 ${r.games}/${laneNeed})`;
    return `=티어(CP ${r.cp}) → ${r.tier} ${r.points}점 · ${ln}MMR ${r.mmr} · ${ln}${r.games}판${pending}`;
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
      <span>평균 {durKo(data.summary.avg_duration_sec)}</span>
      · <time datetime={data.timestamp} title={stampFull(data.timestamp)}>갱신 {stampShort(data.timestamp)}</time>
    </p>

    <div class="views" role="group" aria-label="사다리 보기">
      <button type="button" class="vb" aria-pressed={mode === 'all'} onclick={() => setMode('all')}>라인별</button>
      <button type="button" class="vb" aria-pressed={mode === 'one'} onclick={() => setMode('one')}>통합</button>
    </div>

    <div class="ladder">
      <!-- 보기(라인별·통합)가 바뀌면 표를 새로 만든다. 라인 드롭다운은 표 안에 있으므로 라인이 바뀔 때는
           그대로 두어 초점이 드롭다운에 남는다(rows 가 바뀌면 접기는 저절로 초기화된다) -->
      {#key mode}
        <DataTable {rows} {cols} {caption} {sortKey} sortDir={1} lowerBetterKeys={LOWER}
                   rowKey={(r) => r.key} selectedKey={selected ?? undefined} {onselect}
                   {rowClass} filter={false} />
      {/key}
    </div>

    <p class="note">{placeNote}</p>
    {#if note}
      <p class="note">{note.text} <QMark text={note.tip} label={note.tipLabel} /></p>
    {/if}
    <p class="note"><a class="more" href={href(['math', 'cp'])}>티어 계산식 →</a></p>
  </section>
{/if}

<style>
  .home { display: flex; flex-direction: column; gap: var(--sp-3); }

  /* 한 줄 메타 — 무채색, 큰 숫자 타일 없음 */
  .meta { color: var(--dim); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
  .meta time { color: var(--dim); }

  /* 보기 버튼 — 셀 모양의 작은 버튼 둘. 눌린 것은 선택색 테두리 */
  .views { display: flex; flex-wrap: wrap; gap: var(--sp-1); }
  .vb {
    min-height: 28px;
    padding: 0 var(--sp-2);
    background: var(--sheet);
    color: var(--dim);
    border: 1px solid var(--grid-strong);
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

  /* 사다리 — 표 안 조건부 서식은 DataTable 의 클래스(t1~t5·pend·lane-*·win·loss). 여기 것만 덧댄다 */
  .ladder :global(tr.unp td:not(.rn)) { color: var(--dim); }
  /* 배치 미완 밴드 앞 구분선 — 마지막 배치 완료 행의 아래 선을 굵게 */
  .ladder :global(tr:not(.unp):has(+ tr.unp) td) { border-bottom: 2px solid var(--grid-strong); }
  .ladder :global(td.medal) { font-weight: 650; color: var(--txt); }
  .ladder :global(td.m1) { border-left: 3px solid var(--t1); }
  .ladder :global(td.m2) { border-left: 3px solid var(--dim2); }
  .ladder :global(td.m3) { border-left: 3px solid var(--t4); }
  /* 상위 3 은 행 번호 홈통도 굵게 — 폰에서 순위 열이 숨어도 홈통이 순위를 말한다 */
  .ladder :global(tr.medal td.rn) { font-weight: 650; color: var(--txt); }
  .ladder :global(td.wr-dim) { color: var(--dim); }

  .note { max-width: 75ch; color: var(--dim); font-size: var(--fs-sm); text-wrap: pretty; }
  /* 계산식 링크 — 표 아래 한 줄. 글자색은 무채색, 밑줄이 링크임을 말한다 */
  .more { display: inline-block; min-height: 28px; color: var(--txt); text-underline-offset: .2em; }
  .more:hover { text-decoration-thickness: 2px; }

  @media (pointer: coarse) {
    .vb { min-height: 44px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .vb { transition: none; }
  }
</style>
