<script lang="ts">
  /**
   * 멤버 · 세부 지표 — metric_groups 순서대로 그룹마다 이름 있는 범위(캡션 + 격자 표) 하나.
   * 열: 지표(코드 판은 설명에 대회식 코드가 실제로 있을 때만) · 라인(통합 보기에서 라인별 지표의 대표 라인) ·
   * 값 · 판수 · 순위 rank/n · 백분위(데이터 막대, 낮을수록 좋은 지표는 막대 없음).
   *
   * 표는 DataTable 이 아니라 여기 격자다(AxisBars 와 같은 이유): DataTable 의 막대는 **열 최대값 기준**이라
   * 백분위 열에 쓰면 그룹에서 제일 높은 행이 늘 꽉 찬 막대가 된다 — 백분위는 0~100 이 절대 눈금이다.
   * 정렬·거르기·접기는 없다(그룹당 최대 22행, 순서는 지표 등록부의 뜻 순서). 격자 모양은 DataTable 과 같은
   * 규칙(행 번호 홈통 · 첫 열 sticky · 1px --grid · 막대는 셀 바탕 --bar).
   *
   * 라인이 2개 이상인 멤버는 위에 라인 알약 줄 — 기본은 통합. 통합 지표가 없으면(문턱 미만) '전체' 알약을
   * 아예 두지 않고 첫 라인이 기본이다(누를 수 있는데 빈 표만 나오는 알약을 두지 않는다).
   * 라인별 값은 1판부터 실리므로 판수는 항상 적고, 문턱 미만 행은 글자를 옅게 한다(.thin).
   * 행을 선택하면 그 지표의 순위 화면으로 간다(같은 라인이면 그 라인의 순위).
   */
  import type { GuildPayload, LaneId, PlayerPub } from '$lib/data/types';
  import { announce } from '$lib/a11y';
  import { pct } from '$lib/fmt';
  import { isLaneId, laneKo } from '$lib/lanes';
  import { laneCls } from '$lib/member';
  import { metricLanes, metricRows, type MetricGroupRows, type MetricRow } from '$lib/member-rest';
  import { metricHref, router } from '$lib/router.svelte';
  import CodePlate from '$components/CodePlate.svelte';
  import EmptyState from '$components/EmptyState.svelte';

  interface Props { key: string; p: PlayerPub; data: GuildPayload }
  let { key, p, data }: Props = $props();

  const need = $derived(data.min_games ?? 5);
  const needLane = $derived(data.min_games_lane ?? 3);
  const lanes = $derived(metricLanes(p));
  const hasAll = $derived(!!p.metrics && Object.keys(p.metrics).length > 0);

  // 사용자가 누른 라인은 그 멤버에게 있을 때만 유효하다(사람이 바뀌면 통합으로) — 옛 화면과 같은 규칙.
  // 통합 지표가 아예 없으면(문턱 미만) 첫 라인을 기본으로 삼는다: 빈 표보다 있는 표가 먼저다.
  let picked = $state('');
  const lane = $derived<'' | LaneId>(
    isLaneId(picked) && lanes.includes(picked) ? picked : hasAll ? '' : (lanes[0] ?? ''),
  );
  const groups = $derived(metricRows(p, data.metric_meta, data.metric_groups, lane, {
    lower: data.lower_better, minGames: need, minGamesLane: needLane,
  }));

  function pick(l: string) {
    picked = l;
    announce(l ? `${laneKo(l)} 지표` : '전체 라인 지표');
  }

  /** 통합 보기에서 라인별 지표가 든 그룹만 라인 열을 가진다(라인 보기에서는 위에 이미 적혀 있다) */
  const showLane = (g: MetricGroupRows) => !lane && g.rows.some((r) => r.lane !== null);

  function open(r: MetricRow) {
    router.go(metricHref(r.key, lane || r.lane || undefined));
  }
  function onRowKey(e: KeyboardEvent, r: MetricRow) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    open(r);
  }

  const emptyText = $derived(
    lane
      ? `아직 ${laneKo(lane)} 지표가 없습니다.`
      : `아직 세부 지표가 없습니다. ${need}판 이상부터 집계합니다.`,
  );
</script>

{#snippet grid(g: MetricGroupRows)}
  {@const withLane = showLane(g)}
  <div class="sheet">
    <div class="cap">{g.group}</div>
    <table aria-label={g.group}>
      <thead>
        <tr>
          <th class="rn" aria-hidden="true"></th>
          <th scope="col" class="c0">지표</th>
          {#if withLane}<th scope="col" class="lo">라인</th>{/if}
          <th scope="col" class="num">값</th>
          <th scope="col" class="num">판수</th>
          <th scope="col" class="num">순위</th>
          <th scope="col" class="num">백분위</th>
        </tr>
      </thead>
      <tbody>
        {#each g.rows as r, i (r.key)}
          <tr class:thin={r.thin} tabindex="0" onclick={() => open(r)} onkeydown={(e) => onRowKey(e, r)}>
            <td class="rn" aria-hidden="true">{i + 1}</td>
            <td class="c0">{r.label}<CodePlate code={r.code} /></td>
            {#if withLane}<td class="lo {laneCls(r.lane)}">{r.lane ? laneKo(r.lane) : ''}</td>{/if}
            <td class="num">{r.text}</td>
            <td class="num">{r.games}</td>
            <td class="num">{r.rankText}</td>
            <td class="num" class:bar={r.bar !== null} style:--bar={r.bar !== null ? `${r.bar}%` : undefined}>{pct(r.pct)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/snippet}

<div class="metrics">
  {#if lanes.length >= 2}
    <div class="lanes" role="group" aria-label="라인 선택">
      {#if hasAll}<button type="button" class="pill" aria-pressed={lane === ''} onclick={() => pick('')}>전체</button>{/if}
      {#each lanes as L (L)}
        <button type="button" class="pill" aria-pressed={lane === L} onclick={() => pick(L)}>{laneKo(L)}</button>
      {/each}
      <span class="hint">
        {lane ? `${laneKo(lane)} 출전 판만 집계 · ${laneKo(lane)}끼리 비교` : '라인을 선택하면 해당 라인 경기만 집계합니다'}
      </span>
    </div>
  {/if}

  {#if groups.length === 0}
    <EmptyState text={emptyText} />
  {:else}
    {#each groups as g (`${key}|${lane}|${g.group}`)}
      {@render grid(g)}
    {/each}
    <p class="note">
      순위·백분위는 {lane ? `${laneKo(lane)} 출전 멤버` : '방 전체'} 안에서의 위치입니다.
      판수가 {need}판(라인별 지표 {needLane}판) 미만인 지표는 옅게 표시합니다.
      낮을수록 좋은 지표는 막대를 그리지 않습니다. 행을 선택하면 그 지표의 순위 화면으로 이동합니다.
    </p>
  {/if}
</div>

<style>
  .metrics { display: grid; gap: var(--sp-3); }

  /* 라인 알약 줄 — 선택 상태는 aria-pressed(글자·테두리·바탕 셋 다 바뀐다: 색만으로 구분하지 않는다) */
  .lanes {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
  }
  .pill {
    height: var(--row-h);
    padding: 0 var(--sp-3);
    border: 1px solid var(--grid-strong);
    border-radius: var(--r-chip);
    background: var(--gutter);
    color: var(--dim);
    font-size: var(--fs-sm);
    white-space: nowrap;
    transition: background-color .15s, color .15s, border-color .15s;
  }
  .pill:hover { background: var(--raised); color: var(--txt); }
  .pill:active { background: var(--grid-strong); }
  .pill:disabled { color: var(--dim2); border-color: var(--grid); cursor: default; background: var(--gutter); }
  .pill[aria-pressed='true'] {
    background: var(--sheet);
    color: var(--txt);
    border-color: var(--sel);
  }
  .hint { font-size: var(--fs-sm); color: var(--dim); }

  /* 격자 — DataTable 과 같은 규칙. 넘치면 표만 가로 스크롤(첫 열 sticky).
     --bar 는 셀마다 인라인(style:--bar)으로 들어온다 — 기본 0% 면 막대가 없다 */
  .sheet {
    --rn-w: 36px;
    --bar: 0%;
    overflow-x: auto;
    background: var(--sheet);
  }
  .cap {
    position: sticky;
    left: 0;
    font-size: var(--fs-sm); font-weight: 700;
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-variant-numeric: tabular-nums;
  }
  th, td {
    height: var(--row-h);
    padding: 0 var(--sp-2);
    text-align: left;
    white-space: nowrap;
    vertical-align: middle;
    border-bottom: 1px solid var(--grid);
    border-right: 1px solid var(--grid);
    transition: background-color .12s;
  }
  th:first-child, td:first-child { border-left: 1px solid var(--grid); }
  .num { text-align: right; }
  thead th {
    background: var(--gutter);
    color: var(--dim);
    font-size: var(--fs-sm);
    font-weight: 700;
    border-top: 1px solid var(--grid-strong);
    border-bottom: 1px solid var(--grid-strong);
  }
  .rn {
    position: sticky;
    left: 0;
    z-index: 1;
    width: var(--rn-w);
    min-width: var(--rn-w);
    max-width: var(--rn-w);
    padding: 0 var(--sp-1);
    text-align: right;
    font-size: var(--fs-sm);
    color: var(--dim2);
    background: var(--gutter);
    border-right: 1px solid var(--grid-strong);
  }
  .c0 {
    position: sticky;
    left: var(--rn-w);
    z-index: 1;
    background: var(--sheet);
    border-right: 1px solid var(--grid-strong);
  }
  thead .c0 { background: var(--gutter); }

  /* 행: 전체가 링크(순위 화면). hover 는 채움, 초점은 전역 초점 고리(2px --sel) + 채움 */
  tbody tr { cursor: pointer; }
  tbody tr:hover, tbody tr:focus-visible { background: var(--raised); }
  tbody tr:hover td.c0, tbody tr:focus-visible td.c0 { background: var(--raised); }
  tbody tr:active td { background: var(--grid-strong); }

  /* 백분위 막대 — 절대 눈금(0~100). 별도 요소 없이 셀 바탕 */
  td.bar {
    background: linear-gradient(to right, color-mix(in srgb, var(--sel) 22%, transparent) var(--bar), transparent var(--bar));
  }
  /* 라인 띠 — DataTable 의 lane-* 와 같은 모양 */
  td.lane-top { box-shadow: inset 3px 0 0 var(--lane-top); }
  td.lane-jg { box-shadow: inset 3px 0 0 var(--lane-jg); }
  td.lane-mid { box-shadow: inset 3px 0 0 var(--lane-mid); }
  td.lane-bot { box-shadow: inset 3px 0 0 var(--lane-bot); }
  td.lane-sup { box-shadow: inset 3px 0 0 var(--lane-sup); }

  /* 문턱 미만 행 — 판수 열이 이유를 말하고, 글자는 한 단계 옅게 */
  tr.thin td { color: var(--dim); }

  .note {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--dim);
    text-wrap: pretty;
  }
  @media (max-width: 640px) {
    .lo { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pill, th, td { transition: none; }
  }
</style>
