<script lang="ts">
  /**
   * 듀오 카드 띠 — 시너지 · 듀오 표 위의 카드(Panel) 하나. 함께 판수가 많은 순 상위 5쌍(`spotlightRows`, 문턱 이상).
   * 순서는 사실(함께 뛴 판수)이고 시너지 값은 카드 안 숫자로만 둔다 — 시너지가 우연 수준이라 1위를 빛내지 않는다.
   *
   * - 카드: 두 이름(＋ 는 무채색), 승률(단계 색 + ▲▼, 구간 기준) · n승 n패 · n판, 승률 게이지 막대, 시너지 값. 순번은 오른쪽 위.
   * - 카드는 버튼이다. 누르면 표 행을 누른 것과 같다(onselect) — 수식 줄에 근거, 같은 카드를 다시 누르면 첫 멤버 화면.
   *   지금 선택된 쌍(표에서 골랐어도)은 aria-pressed + 글로우. 마우스 기기에서는 호버 들림(.lift).
   * - 폰(≤640px): 카드 한 장 안의 5행 목록 — 막대는 숨기고 두 줄(이름 / 승률·판수·시너지).
   * - 게이지는 버튼 안이라 숨긴다(aria-hidden) — 같은 숫자를 버튼 이름이 글로 읽는다.
   */
  import { sgn } from '$lib/fmt';
  import { JOIN, type DuoRow } from '$lib/synergy';
  import Panel from '$components/Panel.svelte';
  import WinGauge from '$components/WinGauge.svelte';
  import WinRate from '$components/WinRate.svelte';

  interface Props {
    /** spotlightRows 결과(최대 5) — 비면 아무것도 그리지 않는다 */
    rows: readonly DuoRow[];
    /** 승률 단계 문턱(app.minGames) */
    minGames: number;
    /** 지금 선택된 쌍의 키(표와 같은 키) */
    selectedKey?: string;
    onselect: (r: DuoRow, key: string) => void;
  }
  let { rows, minGames, selectedKey, onselect }: Props = $props();

  const wins = (r: DuoRow) => Math.round(r.winrate * r.games);
</script>

{#if rows.length}
  <Panel title="함께 판 상위 듀오" level={3} glyph="duo">
    <ol class="spot">
      {#each rows as r, i (r.key)}
        {@const on = r.key === selectedKey}
        <li>
          <button type="button" class={['d', 'tile', 'lift', on && 'glow']} aria-pressed={on} onclick={() => onselect(r, r.key)}>
            <span class="no" aria-hidden="true">{i + 1}</span>
            <span class="pair">{r.na}<span class="j">{JOIN}</span>{r.nb}</span>
            <span class="rec"><WinRate w={r.winrate} n={r.games} {minGames} /><span class="wl">{wins(r)}승 {r.games - wins(r)}패 · {r.games}판</span></span>
            <span class="bar" aria-hidden="true"><WinGauge w={r.winrate} n={r.games} {minGames} variant="bar" /></span>
            <span class="syn">시너지 {sgn(r.synergy)}</span>
          </button>
        </li>
      {/each}
    </ol>
  </Panel>
{/if}

<style>
  /* 카드 폭 170px 이상으로 채운다 — 데스크톱(1100px)은 5장 한 줄, 그보다 좁으면 3장·2장으로 감싼다 */
  .spot {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 10px;
  }
  .spot li { min-width: 0; display: flex; }

  .d {
    flex: 1 1 auto;
    min-width: 0;
    display: grid;
    align-content: start;
    gap: 6px;
    padding: var(--sp-3);
    text-align: left;
    color: var(--txt);
    font-size: var(--fs-md);
  }
  /* 선택 카드는 호버 중에도 액센트 테두리를 지킨다(.lift:hover 의 테두리색보다 앞선다) */
  .d.glow { border-color: color-mix(in srgb, var(--sel) 55%, var(--grid)); }
  .no {
    position: absolute;
    top: 10px;
    right: var(--sp-3);
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--dim);
    font-variant-numeric: tabular-nums;
  }
  .pair { padding-right: 1.5em; font-weight: 700; overflow-wrap: anywhere; }
  .j { color: var(--dim); font-weight: 400; }
  .rec { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: var(--sp-2); }
  .wl, .syn { color: var(--dim); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
  .bar { display: block; padding: 2px 0; }

  /* 폰: 카드 한 장(Panel) 안의 목록 — 행 사이 선, 막대 없음, 두 줄(이름 / 승률·판수 …… 시너지) */
  @media (max-width: 640px) {
    .spot { grid-template-columns: minmax(0, 1fr); gap: 0; }
    .d {
      grid-template-columns: 1.4em minmax(0, 1fr) auto;
      gap: 0 var(--sp-2);
      align-items: baseline;
      min-height: 44px;
      padding: 4px 4px 4px 0;
      line-height: 1.35;
      background: none;
      border-width: 0 0 1px;
      border-radius: 0;
      box-shadow: none;
    }
    .spot li:last-child .d { border-bottom-width: 0; }
    .no { position: static; grid-row: 1 / span 2; text-align: center; }
    .pair { grid-column: 2 / -1; grid-row: 1; padding-right: 0; }
    .rec { grid-column: 2; grid-row: 2; }
    .syn { grid-column: 3; grid-row: 2; text-align: right; white-space: nowrap; }
    .bar { display: none; }
    /* 선택 행 — 표의 선택 행과 같은 말(왼쪽 3px 액센트 + 한 단 밝은 바탕) */
    .d.glow { background: var(--raised); box-shadow: inset 3px 0 0 var(--sel); }
  }
  /* 강제 색상: 글로우·바탕이 지워진다 — 선택은 테두리로 */
  @media (forced-colors: active) {
    .d[aria-pressed='true'] { border: 2px solid Highlight; }
  }
</style>
