<script lang="ts">
  /**
   * 시너지 히트맵 — 멤버 × 멤버 격자. 표와 같은 격자 단위(칸 = 행 높이 정사각형), 칸 채움은
   * 시너지 부호(--win/--loss)와 세기(실값 범위 peak 로 눈금, 8%~45% 섞음 — 45% 까지는 --txt 글자가
   * 4.5:1 을 지킨다(실측 win 4.77 · loss 5.54)). 글자는 늘 값(+0.07)이라 색만으로 읽히지 않는다.
   *
   * - 판수 문턱 미만은 빈 칸(툴팁이 왜 비었는지 말한다). 같은 사람 칸은 홈통 바탕.
   * - 첫 열(이름)은 sticky left. 머리행 이름은 세로쓰기(스프레드시트의 '텍스트 회전') —
   *   34명이면 가로 1,300px 이라 이름을 가로로 두면 격자가 표가 아니라 목록이 된다.
   * - 래퍼가 가로 스크롤(문서는 넘치지 않는다). 머리행 sticky top 은 스크롤 컨테이너 안에서
   *   문서 스크롤을 못 따라오므로 두지 않는다(DataTable 과 같은 이유).
   * - 키보드: 값 있는 칸 하나만 tabindex 0(roving). ←→↑↓ 로 같은 행·열의 다음 값 칸, Home/End 로
   *   행의 양 끝, Enter/Space 로 선택. 선택 칸은 2px --sel 안쪽 선 + aria-selected, 그 행·열 머리가 밝아진다.
   * - 툴팁·설명은 $lib/tip 액션(초점·hover·탭) — 칸마다 aria-describedby 로 자기 문구에 연결된다.
   * - 폰(≤640px): 머리행은 세로쓰기 대신 **2자 약칭**(겹치면 3자, shortNames) 을 가로로, 보조기술에는
   *   aria-label 로 전체 이름. 약칭 → 전체 이름 표는 범례 아래 한 줄. 그 위 폭은 세로쓰기 그대로.
   */
  import { tip } from '$lib/tip';
  import { media } from '$lib/media.svelte';
  import { heatMatrix, heatSign, heatT, heatText, heatTip, shortNames, type HeatCell } from '$lib/synergy';
  import type { SynergyRow } from '$lib/data/types';
  import EmptyState from '$components/EmptyState.svelte';

  interface Props {
    synergy: readonly SynergyRow[];
    /** 판수 문턱 — 미만은 빈 칸 (app.minGames) */
    minGames: number;
    caption?: string;
    selectedKey?: string;
    onselect?: (c: HeatCell) => void;
  }
  let { synergy, minGames, caption = '시너지 히트맵', selectedKey, onselect }: Props = $props();

  const m = $derived(heatMatrix(synergy, null, minGames));
  const n = $derived(m.names.length);
  const phone = $derived(media.phone);
  const short = $derived(phone ? shortNames(m.names) : m.names);
  /** 약칭 표 — 이름과 다른 것만 */
  const abbr = $derived(phone ? m.names.map((nm, i) => ({ s: short[i]!, nm })).filter((x) => x.s !== x.nm) : []);
  const shownCount = $derived(m.cells.reduce((t, row) => t + row.filter((c) => c?.synergy != null).length, 0) / 2);

  let table = $state<HTMLTableElement | undefined>();
  let hov = $state<{ i: number; j: number } | null>(null);
  // roving tabindex — 값 있는 첫 칸에서 시작한다. 격자가 새로 오면(사람이 바뀌면) 다시 첫 칸
  let cur = $state<{ i: number; j: number } | null>(null);
  const first = $derived.by((): { i: number; j: number } | null => {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (m.cells[i]![j]?.synergy != null) return { i, j };
    return null;
  });
  const focusAt = $derived(cur && m.cells[cur.i]?.[cur.j]?.synergy != null ? cur : first);

  const has = (i: number, j: number) => m.cells[i]?.[j]?.synergy != null;
  const cls = (c: HeatCell | null, i: number, j: number) => [
    'hc',
    i === j && 'self',
    c?.synergy != null && ['neg', 'zero', 'pos'][heatSign(c.synergy) + 1],
    c?.synergy == null && i !== j && 'blank',
    c && c.key === selectedKey && 'sel',
  ];
  const selCell = $derived.by((): { i: number; j: number } | null => {
    if (!selectedKey) return null;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (m.cells[i]![j]?.key === selectedKey) return { i, j };
    return null;
  });
  /** 머리 밝힘 — hover 중이거나 선택된 칸의 행·열 */
  const headOn = (k: number): boolean =>
    (!!hov && (hov.i === k || hov.j === k)) || (!!selCell && (selCell.i === k || selCell.j === k));

  function pick(c: HeatCell | null, i: number, j: number) {
    if (!c || c.synergy == null) return;
    cur = { i, j };
    onselect?.(c);
  }
  /** 같은 행(dj)·열(di)에서 다음 값 칸 */
  function step(i: number, j: number, di: number, dj: number): { i: number; j: number } | null {
    for (let a = i + di, b = j + dj; a >= 0 && a < n && b >= 0 && b < n; a += di, b += dj) if (has(a, b)) return { i: a, j: b };
    return null;
  }
  function edge(i: number, end: boolean): { i: number; j: number } | null {
    if (end) { for (let j = n - 1; j >= 0; j--) if (has(i, j)) return { i, j }; }
    else { for (let j = 0; j < n; j++) if (has(i, j)) return { i, j }; }
    return null;
  }
  function onKey(e: KeyboardEvent, c: HeatCell | null, i: number, j: number) {
    let to: { i: number; j: number } | null = null;
    switch (e.key) {
      case 'ArrowRight': to = step(i, j, 0, 1); break;
      case 'ArrowLeft': to = step(i, j, 0, -1); break;
      case 'ArrowDown': to = step(i, j, 1, 0); break;
      case 'ArrowUp': to = step(i, j, -1, 0); break;
      case 'Home': to = edge(i, false); break;
      case 'End': to = edge(i, true); break;
      case 'Enter': case ' ': e.preventDefault(); pick(c, i, j); return;
      default: return;
    }
    e.preventDefault();
    if (!to) return;
    cur = to;
    table?.querySelector<HTMLElement>(`td[data-i="${to.i}"][data-j="${to.j}"]`)?.focus();
  }
</script>

<div class="heat">
  <div class="cap">{caption}</div>
  {#if n < 2}
    <EmptyState text="아직 함께 {minGames}판 이상 출전한 조합이 없습니다." />
  {:else}
    <div class="scroll">
      <table role="grid" aria-label={caption} bind:this={table} onmouseleave={() => { hov = null; }}>
        <thead>
          <tr>
            <th scope="col" class="corner"><span class="sr-only">멤버</span></th>
            {#each m.names as name, j (name)}
              <th scope="col" class={['col', phone && 'ab', headOn(j) && 'on']} aria-label={phone ? name : undefined}>
                <span class="nm">{short[j]}</span>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each m.names as name, i (name)}
            <tr>
              <th scope="row" class={['row', headOn(i) && 'on']}><span class="nm">{name}</span></th>
              {#each m.cells[i] as c, j (m.names[j])}
                {#if c && c.synergy != null}
                  <td role="gridcell" class={cls(c, i, j)} style:--t={heatT(c.synergy, m.peak)}
                      data-i={i} data-j={j}
                      tabindex={focusAt && focusAt.i === i && focusAt.j === j ? 0 : -1}
                      aria-selected={c.key === selectedKey}
                      use:tip={heatTip(c, minGames)}
                      onclick={() => pick(c, i, j)}
                      onkeydown={(e) => onKey(e, c, i, j)}
                      onmouseenter={() => { hov = { i, j }; }}
                  >{heatText(c.synergy)}</td>
                {:else if c}
                  <td role="gridcell" class={cls(c, i, j)} use:tip={heatTip(c, minGames)} onmouseenter={() => { hov = { i, j }; }}></td>
                {:else}
                  <td role="gridcell" class={cls(c, i, j)} onmouseenter={() => { hov = { i, j }; }}></td>
                {/if}
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="legend">
      <span class="sw neg" aria-hidden="true"></span>−{m.peak.toFixed(2)} 기대보다 덜 맞음
      <span class="sep" aria-hidden="true">·</span>
      <span class="sw pos" aria-hidden="true"></span>+{m.peak.toFixed(2)} 기대보다 잘 맞음
      <span class="sep" aria-hidden="true">·</span>
      색 눈금은 실값 최대(±{m.peak.toFixed(2)}) 기준
      <span class="sep" aria-hidden="true">·</span>
      빈 칸 = 함께 {minGames}판 미만
      <span class="sep" aria-hidden="true">·</span>
      {n}명 · {shownCount}조합
    </p>
    {#if abbr.length}
      <p class="abbr">
        <span class="k">약칭</span>
        {#each abbr as x, i (x.nm)}{#if i}{' · '}{/if}<span class="pair"><span class="s">{x.s}</span> {x.nm}</span>{/each}
      </p>
    {/if}
  {/if}
</div>

<style>
  /* min-width 0: 격자 항목(그리드 안)의 기본 min-width:auto 는 내용(격자 950px)만큼 늘어나 문서를 넘치게 한다 */
  .heat { width: 100%; min-width: 0; }
  .cap {
    font-size: var(--fs-xs);
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  .scroll {
    overflow-x: auto;
    background: var(--sheet);
  }
  table {
    border-collapse: separate;   /* collapse 면 sticky 첫 열의 선이 스크롤에 떨어져 나간다 */
    border-spacing: 0;
    font-variant-numeric: tabular-nums;
  }
  th, td {
    padding: 0;
    border-right: 1px solid var(--grid);
    border-bottom: 1px solid var(--grid);
    background: transparent;
    white-space: nowrap;
    vertical-align: middle;
  }
  th:first-child, td:first-child { border-left: 1px solid var(--grid); }
  thead th { border-top: 1px solid var(--grid-strong); border-bottom: 1px solid var(--grid-strong); }

  /* 머리행 — 홈통 바탕, 이름은 세로쓰기(한글은 바로 서고 로마자는 눕는다). 아래쪽(격자 쪽)에 붙인다 */
  thead th {
    background: var(--gutter);
    color: var(--dim);
    font-size: var(--fs-xs);
    font-weight: 500;
    vertical-align: bottom;
    transition: background-color .12s, color .12s;
  }
  th.col {
    width: var(--row-h);
    min-width: var(--row-h);
    max-width: var(--row-h);
    padding: var(--sp-2) 0 var(--sp-1);
  }
  th.col .nm {
    display: inline-block;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    max-height: 12em;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: var(--row-h);
  }
  /* 폰: 약칭을 가로로 — 칸 폭(행 높이)에 2~3자가 든다 */
  th.col.ab { height: var(--row-h); padding: 0; text-align: center; vertical-align: middle; }
  th.col.ab .nm {
    display: block;
    writing-mode: horizontal-tb;
    max-height: none;
    max-width: var(--row-h);
    line-height: var(--row-h);
    letter-spacing: -.02em;
  }
  .corner {
    position: sticky;
    left: 0;
    z-index: 3;
    border-right: 1px solid var(--grid-strong);
  }

  /* 첫 열(이름) — sticky left, 시트 바탕 */
  th.row {
    position: sticky;
    left: 0;
    z-index: 1;
    height: var(--row-h);
    padding: 0 var(--sp-2);
    text-align: left;
    font-size: var(--fs-sm);
    font-weight: 500;
    color: var(--txt);
    background: var(--sheet);
    border-right: 1px solid var(--grid-strong);
    transition: background-color .12s;
  }
  th.row .nm {
    display: block;
    max-width: 9em;   /* 한글 9자 — 실데이터 최장 8자(도야짬뽕누룽지탕)가 잘리지 않는다 */
    overflow: hidden;
    text-overflow: ellipsis;
  }
  th.on { background: var(--raised); color: var(--txt); }

  /* 칸 — 행 높이 정사각형. 색은 부호(pos/neg)·세기(--t)로만, 글자는 무채색 */
  .hc {
    --t: 0;
    width: var(--row-h);
    min-width: var(--row-h);
    max-width: var(--row-h);
    height: var(--row-h);
    text-align: center;
    font-size: var(--fs-xs);
    color: var(--txt);
    transition: box-shadow .12s;
  }
  .hc.pos { background: color-mix(in srgb, var(--win) calc(8% + 37% * var(--t)), transparent); }
  .hc.neg { background: color-mix(in srgb, var(--loss) calc(8% + 37% * var(--t)), transparent); }
  .hc.zero { color: var(--dim); }
  .hc.self { background: var(--gutter); }
  .hc.blank { color: var(--dim2); }
  .hc[tabindex] { cursor: pointer; }
  .hc[tabindex]:hover { box-shadow: inset 0 0 0 1px var(--dim); }
  .hc[tabindex]:active { box-shadow: inset 0 0 0 2px var(--dim); }
  .hc.sel, .hc.sel:hover { box-shadow: inset 0 0 0 2px var(--sel); }
  .hc:focus-visible { outline: 2px solid var(--sel); outline-offset: -2px; box-shadow: none; }

  /* 범례 — 안내 문장 한 줄. 견본은 칸과 같은 채움(가장 진한 끝) */
  .legend {
    margin: 0;
    padding-top: var(--sp-2);
    font-size: var(--fs-sm);
    color: var(--dim);
    text-wrap: pretty;
  }
  .sw {
    display: inline-block;
    width: 1em;
    height: 1em;
    margin-right: var(--sp-1);
    vertical-align: -0.15em;
    border: 1px solid var(--grid-strong);
  }
  .sw.pos { background: color-mix(in srgb, var(--win) 45%, transparent); }
  .sw.neg { background: color-mix(in srgb, var(--loss) 45%, transparent); }
  .sep { margin: 0 var(--sp-1); }

  /* 약칭 표 — 범례 아래 한 줄(줄바꿈은 된다). 약칭은 머리와 같은 크기·색 */
  .abbr {
    margin: 0;
    padding-top: var(--sp-1);
    font-size: var(--fs-xs);
    color: var(--dim);
    text-wrap: pretty;
  }
  .abbr .k { margin-right: var(--sp-2); color: var(--dim2); }
  .abbr .pair { white-space: nowrap; }
  .abbr .s { color: var(--txt); }

  @media (prefers-reduced-motion: reduce) {
    th, .hc { transition: none; }
  }
</style>
