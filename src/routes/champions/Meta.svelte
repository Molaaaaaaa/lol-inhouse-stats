<script lang="ts">
  /**
   * 챔피언 · 메타 — 라인 칩 줄(전체 · 탑 … 서폿, 라우트 `#/champions/meta/라인`) 아래 카드 셋:
   * 1. 판수 상위 챔피언 — 그 범위에서 판수가 많은 챔피언 5종을 큰 초상 카드로. 초상 모서리 배지는 **판수**(사실값)다.
   *    등급·순위 글자는 두지 않는다 — 판수 보정 승률의 분위 등급은 실데이터에서 잡음이었다(신뢰도 −0.10).
   * 2. 챔피언 메타 표(챔피언 · [라인] · 판 · 승률 게이지 · KDA · 분당 딜, 판수 내림차순).
   * 3. 챔피언 폭 표(멤버 × 라인 · 판 · 챔피언 종류 · 챔피언 폭).
   * 라인 하나를 선택하면 셋이 함께 그 라인만 보인다.
   *
   * 챔피언 폭 행을 선택하면 수식 줄에 근거(`=챔피언 폭(이름 · 탑) 6종 ÷ 6판 = 100%`), 같은 행을 다시
   * 선택하면 그 멤버 화면으로 간다(멤버 시트(홈)와 같은 규칙 — 표 셀에는 링크를 넣지 못한다).
   * 챔피언 카드·메타·매치업 표는 선택이 없다(갈 곳이 없다). 행 만들기는 $lib/champions 의 순수 함수.
   */
  import type { GuildPayload, LaneId } from '$lib/data/types';
  import { announce } from '$lib/a11y';
  import { fmtMetric, pct } from '$lib/fmt';
  import { LANE_SEQ, isLaneId, laneKo } from '$lib/lanes';
  import { mLabel } from '$lib/metrics';
  import { href, memberHref, router } from '$lib/router.svelte';
  import { clearFx, setFx } from '$lib/fx.svelte';
  import { fxPool, metaRows, poolRows, type MetaRow, type PoolRow } from '$lib/champions';
  import { wrText } from '$lib/tier';
  import type { Col } from '$lib/table';
  import ChampImg from '$components/ChampImg.svelte';
  import DataTable from '$components/DataTable.svelte';
  import LaneChip from '$components/LaneChip.svelte';
  import Panel from '$components/Panel.svelte';
  import WinGauge from '$components/WinGauge.svelte';
  import WinRate from '$components/WinRate.svelte';

  interface Props {
    data: GuildPayload;
    /** 라우트 매개변수 — 라인 id 가 아니면 전체 */
    lane: string;
    /** 승률 단계 문턱(app.minGames) */
    minGames: number;
  }
  let { data, lane, minGames }: Props = $props();

  /** 큰 초상 카드 수 */
  const TOP_N = 5;

  const L = $derived<LaneId | null>(isLaneId(lane) ? lane : null);
  const meta = $derived(metaRows(data, L));
  // metaRows 가 판수 내림차순이다 — 앞에서 다섯
  const top = $derived(meta.slice(0, TOP_N));
  const pool = $derived(poolRows(data.fun, L, data.players));
  // 라인 칩의 숫자 — 그 라인에서 쓰인 챔피언 수
  const counts = $derived.by(() => {
    const m = {} as Record<LaneId, number>;
    for (const l of LANE_SEQ) m[l] = 0;
    for (const r of data.champion_meta_lane ?? []) if (isLaneId(r.lane)) m[r.lane]++;
    return m;
  });
  const scope = $derived(L ? laneKo(L) : '전체');

  const wins = (r: MetaRow) => Math.round(r.winrate * r.games);

  const metaCols = $derived.by((): Col<MetaRow>[] => {
    const mm = data.metric_meta;
    const out: Col<MetaRow>[] = [{ k: 'name', h: '챔피언', img: (r) => r.champ }];
    if (L) out.push({ k: 'laneOrd', h: '라인', lo: true, cell: laneCell, fmt: (_v, r) => laneKo(r.lane) });
    out.push(
      { k: 'games', h: '판', num: true, bar: true },
      { k: 'winrate', h: mLabel(mm, 'winrate'), num: true, cell: gauge, fmt: (_v, r) => wrText(r.winrate, r.games, minGames) },
      { k: 'kda', h: mLabel(mm, 'kda'), num: true, fmt: (v) => fmtMetric('kda', v as number, mm) },
      { k: 'dpm', h: mLabel(mm, 'dpm'), num: true, lo: true, fmt: (v) => fmtMetric('dpm', v as number, mm) },
    );
    return out;
  });
  const poolCols = $derived<Col<PoolRow>[]>([
    { k: 'name', h: '멤버' },
    { k: 'laneOrd', h: '라인', cell: laneCell, fmt: (_v, r) => laneKo(r.lane) },
    { k: 'games', h: '판', num: true },
    { k: 'champs', h: '챔피언', num: true, lo: true, fmt: (v) => `${v}종` },
    { k: 'variety', h: '챔피언 폭', num: true, bar: true, hlp: '챔피언폭', fmt: (v) => pct(v as number) },
  ]);
  const LOWER = ['laneOrd'];

  let selected = $state<string | null>(null);
  function onselect(r: PoolRow, key: string) {
    if (selected === key) { router.go(memberHref(r.name)); return; }
    selected = key;
    setFx(fxPool(r));
  }
  // 라인이 바뀌면 선택과 수식 줄을 비운다(지난 라인의 근거가 남지 않게)
  $effect(() => { void L; selected = null; clearFx(); });

  const say = (l: LaneId | null) => announce(l ? `${laneKo(l)} 챔피언` : '전체 라인 챔피언');
</script>

{#snippet gauge(r: MetaRow)}<WinGauge w={r.winrate} n={r.games} {minGames} />{/snippet}
{#snippet laneCell(r: { lane?: string | null })}<LaneChip lane={r.lane} />{/snippet}

<div class="meta">
  <nav class="chips" aria-label="라인 선택">
    <a class="chip" href={href(['champions', 'meta'])} aria-current={L === null ? 'page' : undefined} onclick={() => say(null)}>전체</a>
    {#each LANE_SEQ as l (l)}
      <a class="chip" href={href(['champions', 'meta', l])} aria-current={L === l ? 'page' : undefined} onclick={() => say(l)}>
        <LaneChip lane={l} games={counts[l]} />
      </a>
    {/each}
  </nav>

  {#key L}
    {#if top.length}
      <Panel title="판수 상위 챔피언 · {scope}" level={3}>
        <ol class="top">
          {#each top as r (r.key)}
            <li class="ch tile">
              <span class="pt"><ChampImg name={r.champ} patch={data.patch} size={44} count={r.games} /></span>
              <span class="nm">{r.name}</span>
              <span class="rec"><WinRate w={r.winrate} n={r.games} {minGames} /><span class="wl">{wins(r)}승 {r.games - wins(r)}패</span></span>
              <span class="bar" aria-hidden="true"><WinGauge w={r.winrate} n={r.games} {minGames} variant="bar" /></span>
            </li>
          {/each}
        </ol>
      </Panel>
    {/if}

    <Panel title="챔피언 메타 · {scope}" level={3}>
      <DataTable rows={meta} cols={metaCols} caption="챔피언 메타 · {scope}" captionHidden sortKey="games" />
    </Panel>

    <Panel title="챔피언 폭 · {scope}" level={3}>
      <DataTable rows={pool} cols={poolCols} caption="챔피언 폭 · {scope}" captionHidden sortKey="games" lowerBetterKeys={LOWER}
                 rowKey={(r) => r.key} selectedKey={selected ?? undefined} {onselect} />
      <p class="note">
        챔피언 폭 = 챔피언 종류 수 ÷ 판수. 7판 7종이면 매판 다른 챔피언, 7판 2종이면 한 챔피언에 집중한 것입니다.
        행을 선택하면 계산 근거가 수식 줄에 보이고, 같은 행을 다시 선택하면 그 멤버 화면으로 이동합니다.
      </p>
    </Panel>
  {/key}
</div>

<style>
  .meta { display: grid; gap: var(--sp-4); }

  /* 판수 상위 챔피언 — 안쪽 타일 카드. 폭 170px 이상으로 채운다(데스크톱 5장 한 줄) */
  .top {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 10px;
  }
  .ch {
    min-width: 0;
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    align-items: center;
    gap: 6px var(--sp-3);
    padding: var(--sp-3) var(--sp-3) 10px;
  }
  .pt { grid-row: 1 / span 2; display: flex; }
  .nm { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rec { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: var(--sp-2); }
  .wl { color: var(--dim); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
  .bar { grid-column: 1 / -1; display: block; padding-top: 6px; }

  .note { margin: var(--sp-3) 0 0; max-width: 75ch; color: var(--dim); font-size: var(--fs-sm); text-wrap: pretty; }

  /* 폰: 초상 줄 — 다섯 칸에 초상(판수 배지)과 이름만. 승률은 바로 아래 표에 있다 */
  @media (max-width: 640px) {
    .top { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
    .ch {
      grid-template-columns: minmax(0, 1fr);
      justify-items: center;
      gap: 6px;
      padding: 10px 4px 8px;
      text-align: center;
    }
    .pt { grid-row: auto; }
    .nm { max-width: 100%; font-size: var(--fs-sm); }
    .rec, .bar { display: none; }
  }
</style>
