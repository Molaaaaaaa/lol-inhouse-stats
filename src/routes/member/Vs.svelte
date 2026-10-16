<script lang="ts">
  /**
   * 멤버 · 상대별 전적 — 카드 둘.
   * (1) 자주 만난 상대: 맞대결 판수가 문턱 이상인 상대 중 많이 만난 순 최대 5명(member-rest 의 frequentOpponents).
   *     한 줄에 상대 이름 · 맞대결 n판 · n승 n패 · 승패 막대. 누르면 그 상대와의 비교 화면.
   *     승패로 줄 세우지 않는다(라이벌 순위로 읽힌다) · 문턱 이상인 상대가 없으면 카드 자체가 없다.
   * (2) 상대별 전적: '나 기준' 한 표. 왼쪽이 항상 상대이고 승패·킬은 전부 내 쪽에서 센다
   *     (뒤집기 규칙은 $lib/member-rest 의 vsRows). 표 아래 열 뜻풀이 한 줄.
   *     행 합계는 싣지 않는다 — 한 판이 상대 다섯 명에게 한 번씩 세어져 29판인 사람이 '맞대결 145판' 이 된다
   *     (옛 화면이 그렇게 적었다). 실제 전적은 멤버 히어로의 승률 게이지가 든다.
   *     행을 선택하면 그 멤버 화면으로 간다(DataTable 셀에는 링크를 못 넣으므로 행 전체가 링크다).
   *     승률 열은 글자색·기호(WinRate — Wilson 구간 기준 단계, 문턱 미만은 '표본 적음').
   */
  import type { GuildPayload, PlayerPub } from '$lib/data/types';
  import { displayName } from '$lib/data/store.svelte';
  import { wrText } from '$lib/tier';
  import { frequentOpponents, vsRows, type VsRow } from '$lib/member-rest';
  import { compareHref, memberHref, router } from '$lib/router.svelte';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';
  import Panel from '$components/Panel.svelte';
  import WinGauge from '$components/WinGauge.svelte';
  import WinRate from '$components/WinRate.svelte';
  import Icon from '$components/Icon.svelte';

  interface Props { key: string; p: PlayerPub; data: GuildPayload }
  let { key, p, data }: Props = $props();

  const rows = $derived(vsRows(data, key));
  const need = $derived(data.min_games ?? 5);
  const me = $derived(displayName(p));
  const top = $derived(frequentOpponents(rows, need));

  const cols = $derived<Col<VsRow>[]>([
    { k: 'opp', h: '상대' },
    { k: 'withGames', h: '함께 판', num: true },
    { k: 'withWr', h: '함께 승률', num: true, nullLast: true, cell: withWr, fmt: (_v, r) => wrText(r.withWr, r.withGames, need) },
    { k: 'vsGames', h: '맞대결 판', num: true },
    { k: 'vsWr', h: '맞대결 승률', num: true, nullLast: true, cell: vsWr, fmt: (_v, r) => wrText(r.vsWr, r.vsGames, need) },
    { k: 'kills', h: '킬', num: true, lo: true, nullLast: true },
    { k: 'deaths', h: '데스', num: true, lo: true, nullLast: true },
  ]);

  function open(r: VsRow) {
    router.go(memberHref(r.opp));
  }
</script>

{#snippet withWr(r: VsRow)}{#if r.withWr != null}<WinRate w={r.withWr} n={r.withGames} minGames={need} />{/if}{/snippet}
{#snippet vsWr(r: VsRow)}{#if r.vsWr != null}<WinRate w={r.vsWr} n={r.vsGames} minGames={need} />{/if}{/snippet}

<div class="vs">
  {#if top.length}
    <Panel title="자주 만난 상대 · 맞대결 판수 순" glyph="versus">
      <ol class="opps">
        {#each top as r (r.key)}
          <li>
            <a class="opp tile lift" href={compareHref(me, r.opp)}>
              <span class="nm">{r.opp}</span>
              <span class="g">맞대결 {r.vsGames}판</span>
              <span class="wl">{r.myWins}승 {r.oppWins}패</span>
              <span class="bar" aria-hidden="true"><WinGauge w={r.vsWr ?? 0} n={r.vsGames} minGames={need} variant="bar" /></span>
              <span class="go"><Icon name="arrow-left-right" /><span class="sr-only">비교</span></span>
            </a>
          </li>
        {/each}
      </ol>
    </Panel>
  {/if}

  <Panel title="상대별 전적">
    {#key key}
      <!-- rows2: 390px 에서 413px(실측) — 폰은 2줄 장부 행 -->
      <DataTable {rows} {cols} caption="상대별 전적" captionHidden sortKey="withGames" rowKey={(r) => r.key} onselect={open} rows2 />
    {/key}
    {#if rows.length}
      <p class="note">
        함께 = 한 팀이었던 판 · 맞대결 = 적으로 만난 판 · 킬·데스 = 맞대결에서 내가 잡은 수·잡힌 수.
        승률 색은 {need}판 이상부터입니다. 행을 선택하면 그 멤버 화면으로 이동합니다.
      </p>
    {/if}
  </Panel>
</div>

<style>
  .vs { display: grid; gap: var(--sp-4); }
  .note {
    margin: 0;
    padding-top: var(--sp-2);
    font-size: var(--fs-sm);
    color: var(--dim);
    text-wrap: pretty;
  }

  /* 자주 만난 상대 — 안쪽 판(.tile) 한 줄씩, 누를 수 있어 호버 들림(.lift, 마우스·움직임 허용일 때만).
     데스크톱: [이름 | 맞대결 n판 | n승 n패 | 막대 | 비교] 한 줄 · 폰: 이름·승패 위, 판수·막대 아래 */
  .opps { display: grid; gap: var(--sp-2); margin: 0; padding: 0; list-style: none; }
  .opp {
    display: grid;
    grid-template-columns: minmax(6em, 1.2fr) auto auto minmax(80px, 2fr) auto;
    grid-template-areas: 'nm g wl bar go';
    align-items: center;
    gap: var(--sp-1) var(--sp-4);
    min-height: 44px;
    padding: var(--sp-2) var(--sp-3);
    color: var(--txt);
    text-decoration: none;
    font-variant-numeric: tabular-nums;
  }
  .opp:hover { background: var(--raised); }
  .opp:focus-visible { outline-offset: 2px; }
  .nm { grid-area: nm; min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .g { grid-area: g; color: var(--dim); font-size: var(--fs-sm); white-space: nowrap; }
  .wl { grid-area: wl; white-space: nowrap; }
  .bar { grid-area: bar; min-width: 0; }
  .go { grid-area: go; display: inline-flex; color: var(--dim); }
  .opp:hover .go { color: var(--txt); }

  @media (max-width: 640px) {
    .opp {
      grid-template-columns: minmax(0, 1fr) auto auto;
      grid-template-areas:
        'nm wl go'
        'g bar bar';
      gap: 6px var(--sp-3);
    }
    .bar { width: 100%; }
  }
</style>
