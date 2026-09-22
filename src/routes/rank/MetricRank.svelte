<script lang="ts">
  /**
   * 지표 순위 — 위에서부터: 분류 칩(개수 병기) → 지표 검색 셀 → 지표 칩 목록 → 선택 지표의 설명 한 줄(코드 판·
   * '낮을수록 좋음') → 라인 버튼(라인별 지표만) → 격자 표(멤버 · [라인] · 순위 · 판 · 값) → 기록 없는 지표 · 문턱 안내.
   *
   * 지표·라인 선택은 URL(`#/rank/metric/:key/:lane?`)이 상태다. 값이 없는 키가 오면 기본 'dpm'(그도 없으면 첫 지표)으로
   * 주소를 바로잡는다. 분류는 선택 지표에서 따라오고(분류를 누르면 그 분류의 첫 지표로 간다), 검색만 화면 로컬이다.
   * 검색은 분류를 무시하고 전체를 훑는다 — 라벨·키·설명(대회식 코드 GD10·CSM 이 설명에 있다)에 초성 포함.
   *
   * 순위·메달은 기본 순서(값, 낮을수록 좋은 지표는 오름차순) 기준으로 $lib/rank 가 미리 박는다.
   * 행 선택은 수식 줄에 `=분당 딜(6판) → 1,296`, 같은 행을 다시 선택하면 멤버 화면.
   */
  import { app } from '$lib/data/store.svelte';
  import { memberHref, metricHref, router } from '$lib/router.svelte';
  import { announce } from '$lib/a11y';
  import { clearFx, setFx } from '$lib/fx.svelte';
  import { fmtMetric } from '$lib/fmt';
  import { LANE_SEQ, isLaneId, laneKo } from '$lib/lanes';
  import { minGamesNote } from '$lib/tier';
  import { lowerBetter, mDesc, mLabel } from '$lib/metrics';
  import { metricCode } from '$lib/metric-code';
  import { laneCls } from '$lib/member';
  import {
    metricByLane, metricGroupOf, metricGroupsAvail, metricKeyOf, metricRows, metricSearch, type MetricRankRow,
  } from '$lib/rank';
  import type { Col } from '$lib/table';
  import type { LaneId, MetricGroup } from '$lib/data/types';
  import DataTable from '$components/DataTable.svelte';
  import CodePlate from '$components/CodePlate.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import QMark from '$components/Tooltip.svelte';
  import Skeleton from '$components/Skeleton.svelte';

  let { params = {} }: { params?: Record<string, string> } = $props();

  const uid = $props.id();
  const data = $derived(app.data);
  const meta = $derived(data?.metric_meta);
  const groups = $derived(data ? metricGroupsAvail(data) : []);
  const flat = $derived(groups.flatMap((g) => g.metrics));
  const key = $derived(metricKeyOf(groups, params.key));
  const byLane = $derived(!!data && !!key && metricByLane(data, key));
  const lane = $derived<'' | LaneId>(byLane && isLaneId(params.lane) ? params.lane : '');
  const group = $derived(metricGroupOf(groups, key));
  const label = $derived(mLabel(meta, key));
  const lower = $derived(lowerBetter(data?.lower_better, key));
  // 설명의 **강조** 표식은 글자로만 그린다(innerHTML 없음). 라벨과 같은 코드(KDA)는 판이 라벨을 되풀이할 뿐이라 안 붙인다
  const desc = $derived(mDesc(meta, key).replace(/\*\*(.+?)\*\*/g, '$1'));
  const code = $derived.by(() => { const c = metricCode(desc); return c === label ? '' : c; });
  const rows = $derived(data && key ? metricRows(data, key, lane) : []);
  const pending = $derived(data?.rankings_pending ?? []);
  const note = $derived(minGamesNote(data, byLane));

  // URL 이 상태다 — 값 없는 키·라인 없는 지표의 라인은 주소를 바로잡는다(한 번, 그 뒤엔 같아서 멈춘다)
  $effect(() => {
    if (!key) return;
    const wantLane = lane || undefined;
    if (params.key !== key || (params.lane || undefined) !== wantLane) router.go(metricHref(key, wantLane));
  });

  // ── 검색 · 칩 ──
  let q = $state('');
  const searching = $derived(q.trim() !== '');
  const hits = $derived(searching ? metricSearch(q, meta, groups) : (groups.find((g) => g.group === group)?.metrics ?? []));
  const countText = $derived(searching ? `검색 ${hits.length}개 / 전체 ${flat.length}개` : `${flat.length}개 지표`);

  function pickGroup(g: MetricGroup) {
    q = '';
    if (g.group === group) return;
    const first = g.metrics[0];
    if (!first) return;
    announce(`${g.group} 지표`);
    router.go(metricHref(first, metricByLane(data ?? {}, first) ? lane || undefined : undefined));
  }
  function pickMetric(k: string) {
    if (k === key) return;
    announce(`${mLabel(meta, k)} 순위`);
    router.go(metricHref(k, metricByLane(data ?? {}, k) ? lane || undefined : undefined));
  }
  function pickLane(l: '' | LaneId) {
    if (l === lane) return;
    announce(l ? `${laneKo(l)} ${label} 순위` : `전체 라인 ${label} 순위`);
    router.go(metricHref(key, l || undefined));
  }

  // ── 표 ──
  let selected = $state<string | null>(null);
  $effect(() => {
    void key; void lane;
    selected = null;
    clearFx();
  });

  const DASH = '—';
  const numOrDash = (v: unknown) => (v == null ? DASH : String(v));
  const isDiff = $derived(key.includes('diff'));
  const cols = $derived.by((): Col<MetricRankRow>[] => {
    const out: Col<MetricRankRow>[] = [
      { k: 'name', h: '멤버' },
      { k: 'rank', h: '순위', num: true, nullLast: true, fmt: numOrDash, cls: (r) => r.medal?.cls ?? '' },
    ];
    if (byLane && !lane) out.push({ k: 'laneOrd', h: '라인', fmt: (_v, r) => laneKo(r.lane), cls: (r) => laneCls(r.lane) });
    out.push(
      { k: 'games', h: '판', num: true },
      {
        // 막대는 값에 비례한다 — 낮을수록 좋은 지표(1등이 가장 짧다)와 차이 지표(음수는 0)에는 그리지 않는다
        k: 'value', h: label, num: true, bar: !lower && !isDiff, code,
        fmt: (v) => fmtMetric(key, v as number, meta),
        // 차이 지표(골드차@10 …)는 0 을 기준으로 승·패 채움 — 글자는 무채색 그대로
        cls: isDiff ? (r) => (r.value > 0 ? 'win' : r.value < 0 ? 'loss' : '') : undefined,
      },
    );
    return out;
  });
  const lowerKeys = $derived(lower ? ['rank', 'laneOrd', 'value'] : ['rank', 'laneOrd']);
  const caption = $derived(`${label} 순위${lane ? ` · ${laneKo(lane)}` : byLane ? ' · 멤버 × 라인' : ''}`);

  const BAND: Readonly<Record<LaneId, string>> = { TOP: 'lane-top', JUNGLE: 'lane-jg', MIDDLE: 'lane-mid', BOTTOM: 'lane-bot', UTILITY: 'lane-sup' };

  /** 수식 줄 — 그 행의 값과 판수. 라인별 행은 라인도 같이 */
  function fxFor(r: MetricRankRow): string {
    const l = r.lane ? `${laneKo(r.lane)} ` : '';
    return `=${label}(${l}${r.games}판) → ${fmtMetric(key, r.value, meta)}`;
  }
  function onselect(r: MetricRankRow, k: string) {
    if (selected === k) { router.go(memberHref(r.name)); return; }
    selected = k;
    setFx(fxFor(r));
  }
</script>

{#if !data}
  <Skeleton rows={8} />
{:else if !key}
  <EmptyState text="아직 표시할 지표가 없습니다." />
{:else}
  <div class="mr">
    <div class="groups" role="group" aria-label="지표 분류">
      {#each groups as g (g.group)}
        <button type="button" class="chip" aria-pressed={g.group === group} onclick={() => pickGroup(g)}>
          {g.group} <span class="n">{g.metrics.length}</span>
        </button>
      {/each}
    </div>

    <div class="find">
      <label class="sr-only" for="{uid}-q">지표 검색</label>
      <input id="{uid}-q" type="search" class="q" bind:value={q}
             placeholder="지표 검색 (이름·코드·설명)" autocomplete="off" spellcheck="false" enterkeyhint="search" />
      <span class="count">{countText}</span>
    </div>

    <div class="chips" role="group" aria-label={searching ? `'${q}' 검색 결과` : `${group} 지표`}>
      {#each hits as k (k)}
        <button type="button" class="chip" aria-pressed={k === key} onclick={() => pickMetric(k)}>{mLabel(meta, k)}</button>
      {:else}
        <span class="none">'{q}' 검색 결과가 없습니다.</span>
      {/each}
    </div>

    <p class="desc">
      <span class="lbl">{label}</span><CodePlate {code} />{#if lower}<span class="dir">낮을수록 좋음</span>{/if}
      {#if desc}<span class="dash">—</span> {desc}{/if}
    </p>

    {#if byLane}
      <div class="lanes" role="group" aria-label="라인 선택">
        <button type="button" class="vb" aria-pressed={lane === ''} onclick={() => pickLane('')}>전체</button>
        {#each LANE_SEQ as l (l)}
          <button type="button" class="vb {BAND[l]}" aria-pressed={lane === l} onclick={() => pickLane(l)}>{laneKo(l)}</button>
        {/each}
        <span class="hint">{lane ? `${laneKo(lane)} 출전 판만 · ${laneKo(lane)}끼리 순위` : '라인별 지표 · 라인을 선택하면 그 라인 안에서 순위를 매깁니다'}</span>
      </div>
    {/if}

    <div class="sheet">
      {#key `${key}|${lane}`}
        <DataTable {rows} {cols} {caption} sortKey="rank" sortDir={1} lowerBetterKeys={lowerKeys}
                   rowKey={(r) => r.key} selectedKey={selected ?? undefined} {onselect} />
      {/key}
    </div>

    {#if pending.length}
      <p class="note">
        기록 없는 지표 {pending.length}개 —
        {#each pending as x (x.key)}
          <span class="pend">{x.label || mLabel(meta, x.key)}<QMark text={x.reason} label="{x.label || mLabel(meta, x.key)} 사유" /></span>
        {/each}
      </p>
    {/if}
    <p class="note">
      {lower ? '낮을수록 좋은 지표라 오름차순이 1위이고 막대를 그리지 않습니다. ' : ''}같은 행을 다시 선택하면 멤버 화면으로 이동합니다.
    </p>
    {#if note}
      <p class="note">{note.text} <QMark text={note.tip} label={note.tipLabel} /></p>
    {/if}
  </div>
{/if}

<style>
  .mr { display: flex; flex-direction: column; gap: var(--sp-3); }

  /* 칩 — 사다리의 보기 버튼과 같은 어휘(작은 셀 모양, 눌린 것은 선택색 테두리 + 떠 있는 바탕). 색만으로 구분하지 않는다 */
  .groups, .chips, .lanes { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-1); }
  .chip, .vb {
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
  .chip:hover, .vb:hover { background: var(--raised); color: var(--txt); }
  .chip:active, .vb:active { background: var(--gutter); }
  .chip:disabled, .vb:disabled { color: var(--dim2); border-color: var(--grid); cursor: default; }
  .chip[aria-pressed='true'], .vb[aria-pressed='true'] { background: var(--raised); color: var(--txt); border-color: var(--sel); }
  .chip .n { color: var(--dim2); font-variant-numeric: tabular-nums; }
  .chip[aria-pressed='true'] .n { color: var(--dim); }
  /* 라인 버튼은 왼쪽 3px 라인 띠 */
  .vb { border-left-width: 3px; border-left-color: transparent; }
  .vb.lane-top { border-left-color: var(--lane-top); }
  .vb.lane-jg { border-left-color: var(--lane-jg); }
  .vb.lane-mid { border-left-color: var(--lane-mid); }
  .vb.lane-bot { border-left-color: var(--lane-bot); }
  .vb.lane-sup { border-left-color: var(--lane-sup); }
  .hint, .none, .count { font-size: var(--fs-sm); color: var(--dim); }
  .none { padding: var(--sp-1) 0; }

  /* 검색 셀 — 표 위의 거르기 칸과 같은 모양(우물 바탕 · 1px 강한 격자선 · 모서리 없음) */
  .find { display: flex; align-items: center; gap: var(--sp-2); }
  .q {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    max-width: 32ch;
    height: var(--row-h);
    padding: 0 var(--sp-2);
    background: var(--ink);
    color: var(--txt);
    border: 1px solid var(--grid-strong);
    border-radius: 0;
    transition: border-color .12s;
  }
  .q:hover { border-color: var(--dim2); }
  .q:focus-visible { outline-offset: 0; }
  .count { white-space: nowrap; }

  /* 선택 지표의 뜻 — 라벨(굵게) · 코드 판 · 방향 판 — 설명 */
  .desc { max-width: 75ch; color: var(--dim); font-size: var(--fs-sm); text-wrap: pretty; }
  .desc .lbl { color: var(--txt); font-weight: 700; }
  .desc .dash { margin-left: var(--sp-1); }
  .dir {
    display: inline-block;
    margin-left: var(--sp-1);
    padding: 0 var(--sp-1);
    border: 1px solid var(--grid);
    border-radius: var(--r-chip);
    background: var(--gutter);
    font-size: var(--fs-sm);
    line-height: 1.4;
    vertical-align: middle;
    white-space: nowrap;
  }

  /* 메달 — 순위 셀 왼쪽 띠(사다리와 같은 모양) */
  .sheet :global(td.medal) { font-weight: 700; color: var(--txt); }
  .sheet :global(td.m1) { border-left: 3px solid var(--t1); }
  .sheet :global(td.m2) { border-left: 3px solid var(--dim2); }
  .sheet :global(td.m3) { border-left: 3px solid var(--t4); }

  .note { max-width: 75ch; color: var(--dim); font-size: var(--fs-sm); text-wrap: pretty; }
  .pend { display: inline-flex; align-items: center; margin-right: var(--sp-2); white-space: nowrap; }

  @media (pointer: coarse) {
    .chip, .vb { min-height: 44px; }
  }
  /* 폰: 표 머리의 코드 판은 접는다 — 바로 위 설명 줄에 같은 코드가 있고, 그 폭(실측 48px)만큼 값 열이 잘렸다 */
  @media (max-width: 640px) {
    .sheet :global(thead .plate) { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .chip, .vb, .q { transition: none; }
  }
</style>
