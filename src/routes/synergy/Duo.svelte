<script lang="ts">
  /**
   * 시너지 · 듀오 — 카드 둘. 위는 듀오 순위 목록(함께 판수 상위 5쌍, DuoSpotlight), 아래는 두 멤버가 같은 팀이었던
   * 판의 표. 열: 듀오 · 함께 판 · 함께 승률(게이지) · 기대 승률 · 시너지 · 리프트(폰에서는 숨김).
   * 표의 기본 정렬은 시너지 내림차순(옛 renderSyn).
   * 표 행(또는 목록 행) 선택 → 수식 줄에 근거(리프트와 판수 보정을 나눠 적는다). 같은 쌍 다시 선택 → 첫 멤버 화면.
   * 목록과 표는 같은 키로 선택을 나눈다 — 목록 행을 누르면 표 행도 선택된다.
   * 승률 단계(색·▲▼)는 구간 기준이고 문턱(min_games) 미만은 '표본 적음' — 2판 100% 를 칠하지 않는다. 시너지 채움은 부호.
   */
  import type { GuildPayload } from '$lib/data/types';
  import { pct, sgn } from '$lib/fmt';
  import { setFx } from '$lib/fx.svelte';
  import { memberHref, router } from '$lib/router.svelte';
  import { duoRows, fxDuo, spotlightRows, synCls, type DuoRow } from '$lib/synergy';
  import { wrText } from '$lib/tier';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';
  import DuoSpotlight from '$components/DuoSpotlight.svelte';
  import Panel from '$components/Panel.svelte';
  import WinGauge from '$components/WinGauge.svelte';

  interface Props { data: GuildPayload; minGames: number }
  let { data, minGames }: Props = $props();

  const rows = $derived(duoRows(data.synergy));
  const spot = $derived(spotlightRows(rows, minGames));
  let selected = $state<string | null>(null);

  const cols = $derived<Col<DuoRow>[]>([
    { k: 'pair', h: '듀오' },
    { k: 'games', h: '함께 판', hs: '판', num: true },
    { k: 'winrate', h: '함께 승률', hs: '승률', num: true, cell: gauge, fmt: (_v, r) => wrText(r.winrate, r.games, minGames) },
    { k: 'expected', h: '기대 승률', hs: '기대', num: true, fmt: (v) => pct(v as number) },
    { k: 'synergy', h: '시너지', num: true, hlp: '시너지', fmt: (v) => sgn(v as number), cls: (r) => synCls(r.synergy) },
    { k: 'lift', h: '리프트', num: true, lo: true, fmt: (v) => sgn(v as number) },
  ]);

  function onselect(r: DuoRow, key: string) {
    if (selected === key) { router.go(memberHref(r.na)); return; }
    selected = key;
    setFx(fxDuo(r));
  }
</script>

{#snippet gauge(r: DuoRow)}<WinGauge w={r.winrate} n={r.games} {minGames} />{/snippet}

<div class="duo">
  <DuoSpotlight rows={spot} {minGames} selectedKey={selected ?? undefined} {onselect} />

  <Panel title="듀오 시너지" level={3} glyph="duo">
    <!-- rows2: 390px 에서 넘친다(실측 407px) — 폰은 2줄 장부 행 -->
    <DataTable {rows} {cols} caption="듀오 시너지" captionHidden sortKey="synergy" rowKey={(r) => r.key} rows2
               selectedKey={selected ?? undefined} {onselect} />
    <p class="note">
      리프트 = 함께 승률 − 기대 승률. 시너지는 리프트를 함께 뛴 판수로 0 쪽에 보정한 값이라 판수가 적을수록 작습니다.
      함께 {minGames}판 미만의 승률은 '표본 적음'으로 적고, 색과 ▲▼는 판수를 감안해도 50%와 차이가 날 때만 붙습니다.
      표나 목록의 행을 선택하면 계산 근거가 수식 줄에, 같은 쌍을 다시 선택하면 첫 멤버 화면으로 이동합니다.
    </p>
  </Panel>
</div>

<style>
  .duo { display: grid; gap: var(--sp-4); }
  .note {
    margin: var(--sp-3) 0 0;
    max-width: 75ch;
    font-size: var(--fs-sm);
    color: var(--dim);
    text-wrap: pretty;
  }
</style>
