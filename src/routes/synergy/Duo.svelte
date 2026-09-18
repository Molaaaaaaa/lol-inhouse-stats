<script lang="ts">
  /**
   * 시너지 · 듀오 — 두 멤버가 같은 팀이었던 판의 표. 열: 듀오 · 함께 판 · 함께 승률 · 기대 승률 ·
   * 시너지 · 리프트(폰에서는 숨김). 기본 정렬은 시너지 내림차순(옛 renderSyn).
   * 행 선택 → 수식 줄에 근거(리프트와 판수 보정을 나눠 적는다). 같은 행 다시 선택 → 첫 멤버 화면.
   * 승률 채움은 문턱(min_games) 이상만 — 2판 100% 를 초록으로 칠하지 않는다. 시너지 채움은 부호.
   */
  import type { GuildPayload } from '$lib/data/types';
  import { pct, sgn } from '$lib/fmt';
  import { setFx } from '$lib/fx.svelte';
  import { wrCls } from '$lib/member';
  import { memberHref, router } from '$lib/router.svelte';
  import { duoRows, fxDuo, synCls, type DuoRow } from '$lib/synergy';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';

  interface Props { data: GuildPayload; minGames: number }
  let { data, minGames }: Props = $props();

  const rows = $derived(duoRows(data.synergy));
  let selected = $state<string | null>(null);

  const cols = $derived<Col<DuoRow>[]>([
    { k: 'pair', h: '듀오' },
    { k: 'games', h: '함께 판', num: true },
    { k: 'winrate', h: '함께 승률', num: true, fmt: (v) => pct(v as number), cls: (r) => wrCls(r.winrate, r.games, minGames) },
    { k: 'expected', h: '기대 승률', num: true, fmt: (v) => pct(v as number) },
    { k: 'synergy', h: '시너지', num: true, hlp: '시너지', fmt: (v) => sgn(v as number), cls: (r) => synCls(r.synergy) },
    { k: 'lift', h: '리프트', num: true, lo: true, fmt: (v) => sgn(v as number) },
  ]);

  function onselect(r: DuoRow, key: string) {
    if (selected === key) { router.go(memberHref(r.na)); return; }
    selected = key;
    setFx(fxDuo(r));
  }
</script>

<div class="duo">
  <DataTable {rows} {cols} caption="듀오 시너지" sortKey="synergy" rowKey={(r) => r.key}
             selectedKey={selected ?? undefined} {onselect} />
  <p class="note">
    리프트 = 함께 승률 − 기대 승률. 시너지는 리프트를 함께 뛴 판수로 0 쪽에 보정한 값이라 판수가 적을수록 작습니다.
    승률 채움은 함께 {minGames}판 이상만 표시합니다. 행을 선택하면 계산 근거가 수식 줄에, 같은 행을 다시 선택하면 첫 멤버 화면으로 이동합니다.
  </p>
</div>

<style>
  .duo { display: grid; gap: var(--sp-3); }
  .note {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--dim);
    text-wrap: pretty;
  }
</style>
