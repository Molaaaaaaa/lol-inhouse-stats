<script lang="ts">
  /**
   * 멤버 · 세부 지표 — metric_groups 순서대로 그룹마다 카드(캡션 + 격자 표) 하나.
   * 열: 지표(코드 판은 설명에 대회식 코드가 실제로 있을 때만) · 라인(통합 보기에서 라인별 지표의 대표 라인) ·
   * 값 · 판수 · 순위 rank/n · 백분위(데이터 막대, 낮을수록 좋은 지표는 막대 없음).
   *
   * 표는 DataTable 이 아니라 여기 격자다(AxisBars 와 같은 이유): DataTable 의 막대는 **열 최대값 기준**이라
   * 백분위 열에 쓰면 그룹에서 제일 높은 행이 늘 꽉 찬 막대가 된다 — 백분위는 0~100 이 절대 눈금이다.
   * 정렬·거르기·접기는 없다(그룹당 최대 22행, 순서는 지표 등록부의 뜻 순서). 격자 모양은 DataTable 과 같은
   * 규칙(행 번호 칩 · 첫 열 sticky · 행 구분선만 · 막대는 셀 아래 3px 띠 --bar). 라인 셀은 라인 점 + 이름(LaneChip).
   * 그룹마다 카드(Panel, 제목 = 그룹 이름). 폰에서 넘치면 SheetCaption(captionHidden — 제목은 카드가 이미 보인다)이
   * DataTable 과 같은 잘림 힌트('열 n개 더 →' + 오른쪽 2px 선)를 그린다.
   *
   * 라인이 2개 이상인 멤버는 위에 라인 고르기 칩(app.css .chip + LaneChip) — 기본은 통합. 통합 지표가 없으면(문턱 미만) '전체'
   * 단추를 아예 두지 않고 첫 라인이 기본이다(누를 수 있는데 빈 표만 나오는 단추를 두지 않는다).
   * 라인별 값은 1판부터 실리므로 판수는 항상 적고, 문턱 미만 행은 글자를 옅게 한다(.thin).
   * 행을 선택하면 그 지표의 순위 화면으로 간다(같은 라인이면 그 라인의 순위).
   */
  import type { GuildPayload, LaneId, PlayerPub } from '$lib/data/types';
  import { announce } from '$lib/a11y';
  import { pct } from '$lib/fmt';
  import { isLaneId, laneKo } from '$lib/lanes';
  import { metricLanes, metricRows, type MetricGroupRows, type MetricRow } from '$lib/member-rest';
  import { metricHref, router } from '$lib/router.svelte';
  import CodePlate from '$components/CodePlate.svelte';
  import Panel from '$components/Panel.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import LaneChip from '$components/LaneChip.svelte';
  import SheetCaption from '$components/SheetCaption.svelte';

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
  <Panel title={g.group}>
    <div class="sheet">
      <SheetCaption caption={g.group} captionHidden />
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
              <td class="rn" aria-hidden="true"><span class="rnc">{i + 1}</span></td>
              <td class="c0">{r.label}<CodePlate code={r.code} /></td>
              {#if withLane}<td class="lo">{#if r.lane}<LaneChip lane={r.lane} />{/if}</td>{/if}
              <td class="num">{r.text}</td>
              <td class="num">{r.games}</td>
              <td class="num">{r.rankText}</td>
              <td class="num" class:bar={r.bar !== null} style:--bar={r.bar !== null ? `${r.bar}%` : undefined}>{pct(r.pct)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Panel>
{/snippet}

<div class="metrics">
  {#if lanes.length >= 2}
    <div class="chips" role="group" aria-label="라인 선택">
      {#if hasAll}<button type="button" class="chip" aria-pressed={lane === ''} onclick={() => pick('')}>전체</button>{/if}
      {#each lanes as L (L)}
        <button type="button" class="chip" aria-pressed={lane === L} onclick={() => pick(L)}><LaneChip lane={L} /></button>
      {/each}
    </div>
    <p class="hint">
      {lane ? `${laneKo(lane)} 출전 판만 집계 · ${laneKo(lane)}끼리 비교` : '라인을 선택하면 해당 라인 경기만 집계합니다'}
    </p>
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
  .metrics { display: grid; gap: var(--sp-4); }

  .hint { margin-top: calc(var(--sp-2) * -1); font-size: var(--fs-sm); color: var(--dim); }

  /* 격자 — DataTable 과 같은 규칙: 세로 격자선 없이 행 구분선만, 머리행은 --gutter 에 위 모서리 12px,
     행 번호는 둥근 칩, 첫 열 sticky. 넘치면 표만 가로 스크롤.
     --bar 는 셀마다 인라인(style:--bar)으로 들어온다 — 기본 0% 면 막대가 없다 */
  .sheet {
    --rn-w: 40px;
    --bar: 0%;
    --stick: var(--sheet);
    position: relative;
    overflow-x: auto;
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
    transition: background-color var(--dur-1);
  }
  tbody tr:last-child td { border-bottom-color: transparent; }
  .num { text-align: right; }
  thead th {
    background: var(--gutter);
    color: var(--dim);
    font-size: var(--fs-sm);
    font-weight: 700;
    border-bottom: 1px solid var(--grid-strong);
  }
  thead th:first-child { border-top-left-radius: var(--r-md); }
  thead th:last-child { border-top-right-radius: var(--r-md); }
  .rn {
    position: sticky;
    left: 0;
    z-index: 1;
    width: var(--rn-w);
    min-width: var(--rn-w);
    max-width: var(--rn-w);
    padding: 0 var(--sp-1);
    text-align: center;
    background: var(--stick);
  }
  thead .rn { background: var(--gutter); }
  .rnc {
    display: inline-grid;
    place-items: center;
    min-width: 24px;
    height: 22px;
    padding: 0 4px;
    border-radius: var(--r-chip);
    background: var(--raised);
    color: var(--dim);
    font-size: var(--fs-xs);
    font-weight: 700;
    line-height: 1;
  }
  .c0 {
    position: sticky;
    left: var(--rn-w);
    z-index: 1;
    background: var(--stick);
  }
  thead .c0 { background: var(--gutter); }
  td.c0 { font-weight: 700; }

  /* 행: 전체가 링크(순위 화면). hover·초점은 채움, 초점은 전역 초점 고리(2px --sel)도 */
  tbody tr { cursor: pointer; }
  tbody tr:hover, tbody tr:focus-visible { background: color-mix(in srgb, var(--raised) 70%, transparent); }
  tbody tr:hover td.c0, tbody tr:focus-visible td.c0,
  tbody tr:hover td.rn, tbody tr:focus-visible td.rn { background: color-mix(in srgb, var(--raised) 70%, var(--sheet)); }
  tbody tr:active td { background: var(--track); }

  /* 백분위 막대 — 절대 눈금(0~100). DataTable 의 데이터 막대와 같은 모양: 셀 아래쪽 3px 띠 */
  td.bar {
    background-image: var(--grad-win);
    background-size: var(--bar) 3px;
    background-position: left bottom 4px;
    background-repeat: no-repeat;
  }

  /* 문턱 미만 행 — 판수 열이 이유를 말하고, 글자는 한 단계 옅게 */
  tr.thin td { color: var(--dim); }

  .note {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--dim);
    text-wrap: pretty;
  }
  /* 폰: 보조 열(라인) 숨김 · 셀 좌우 여백을 DataTable 과 같게 줄여 390px 에 든다(홈통 28px). 그래도 넘치면
     SheetCaption 의 잘림 힌트 */
  @media (max-width: 640px) {
    .lo { display: none; }
    .sheet { --rn-w: 28px; }
    table { width: max-content; min-width: 100%; }   /* 100% 인 채로 이름 셀만 줄바꿈을 허용하면 그 열이 한 글자 폭까지 눌린다(DataTable 실측) */
    th, td { padding: 0 var(--sp-1) 0 6px; }
    .rn { padding: 0 2px; }
    .rnc { min-width: 20px; height: 20px; padding: 0 3px; }
    td.c0 { max-width: 7em; white-space: normal; overflow-wrap: anywhere; }
  }
  @media (prefers-reduced-motion: reduce) {
    th, td { transition: none; }
  }
</style>
