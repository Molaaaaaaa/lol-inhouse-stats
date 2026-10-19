<script lang="ts">
  /**
   * 듀오 순위 목록 — 시너지 · 듀오 표 위의 카드(Panel) 하나 안에 행 5개. 함께 판수가 많은 순 상위 5쌍(`spotlightRows`, 문턱 이상).
   * 순서는 사실(함께 뛴 판수)이고 시너지 값은 행 안 숫자로만 둔다 — 시너지가 우연 수준이라 1위를 빛내지 않는다.
   * 같은 카드 다섯 장을 한 줄로 늘어놓지 않는다(대상 사이트의 상위 5 띠와 배치가 겹친다는 검토 지적).
   *
   * - 행: [순위 칩] 두 이름(＋ 는 무채색) · n판 · 승률(단계 색 + ▲▼, 구간 기준) · 승률 게이지 막대 · n승 n패 · 시너지 값.
   *   열은 전부 고정 폭이거나 fr 이라 행마다 같은 자리에 선다. 행 사이는 1px 선.
   * - 행은 버튼이다. 누르면 표 행을 누른 것과 같다(onselect) — 수식 줄에 근거, 같은 행을 다시 누르면 첫 멤버 화면.
   *   지금 선택된 쌍(표에서 골랐어도)은 aria-pressed — 표의 선택 행과 같은 말(왼쪽 3px 액센트 + 한 단 밝은 바탕).
   * - 폰(≤640px): 두 줄(이름 …… n판 / 승률 · 승패 · 막대 · 시너지), 순위 칩은 두 줄에 걸친다.
   * - 순위 칩·게이지는 버튼 안이라 숨긴다(aria-hidden) — 순서는 목록이, 같은 숫자는 버튼 이름이 글로 읽는다.
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
        <li>
          <button type="button" class="d" aria-pressed={r.key === selectedKey} onclick={() => onselect(r, r.key)}>
            <span class="no" aria-hidden="true">{i + 1}</span>
            <span class="pair">{r.na}<span class="j">{JOIN}</span>{r.nb}</span>
            <span class="g">{r.games}판</span>
            <span class="rt"><WinRate w={r.winrate} n={r.games} {minGames} /></span>
            <span class="bar" aria-hidden="true"><WinGauge w={r.winrate} n={r.games} {minGames} variant="bar" /></span>
            <span class="wl">{wins(r)}승 {r.games - wins(r)}패</span>
            <span class="syn">시너지 {sgn(r.synergy)}</span>
          </button>
        </li>
      {/each}
    </ol>
  </Panel>
{/if}

<style>
  .spot { list-style: none; margin: 0; padding: 0; }
  .spot li { min-width: 0; border-bottom: 1px solid var(--grid); }
  .spot li:last-child { border-bottom-width: 0; }

  /* 데스크톱·태블릿: 한 줄 [칩 | 두 이름 | 판 | 승률 | 막대 | 승패 | 시너지] */
  .d {
    width: 100%;
    min-width: 0;
    display: grid;
    grid-template-columns: 24px minmax(0, 1.5fr) 3.5em 4em minmax(48px, 1fr) 5.5em 7em;
    grid-template-areas: 'no pair g rt bar wl syn';
    align-items: center;
    gap: 0 var(--sp-3);
    min-height: 44px;
    padding: 6px var(--sp-2);
    background: none;
    border: 0;
    text-align: left;
    color: var(--txt);
    font-size: var(--fs-md);
    font-variant-numeric: tabular-nums;
    transition: background-color var(--dur-1);
  }
  .d:hover { background: color-mix(in srgb, var(--raised) 70%, transparent); }
  .d[aria-pressed='true'] { background: var(--raised); box-shadow: inset 3px 0 0 var(--sel); }

  /* 순위 칩 — 표의 행 번호 칩과 같은 모양. 선택 행(raised 바탕) 위에서는 한 단 더 밝게 */
  .no {
    grid-area: no;
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
  .d[aria-pressed='true'] .no { background: var(--track); }
  .pair { grid-area: pair; min-width: 0; font-weight: 700; overflow-wrap: anywhere; }
  .j { color: var(--dim); font-weight: 400; }
  .g { grid-area: g; text-align: right; white-space: nowrap; }
  .rt { grid-area: rt; text-align: right; }
  .bar { grid-area: bar; display: block; min-width: 0; }
  .wl { grid-area: wl; white-space: nowrap; }
  .wl, .syn { color: var(--dim); font-size: var(--fs-sm); }
  .syn { grid-area: syn; text-align: right; white-space: nowrap; }

  /* 폰: 두 줄 — 이름 …… 판 / 승률 · 승패 · 막대 · 시너지. 순위 칩은 두 줄 가운데 */
  @media (max-width: 640px) {
    .d {
      grid-template-columns: 24px 3.6em 4.6em minmax(0, 1fr) 6.6em;
      grid-template-areas:
        'no pair pair pair g'
        'no rt wl bar syn';
      gap: 2px var(--sp-2);
      padding: 6px 4px;
      line-height: 1.35;
    }
    .rt { text-align: left; }
  }
  /* 강제 색상: 바탕·안쪽 선이 지워진다 — 선택은 외곽선으로 */
  @media (forced-colors: active) {
    .d[aria-pressed='true'] { outline: 2px solid Highlight; outline-offset: -2px; }
  }
</style>
