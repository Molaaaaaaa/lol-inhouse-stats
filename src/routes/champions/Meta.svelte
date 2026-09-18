<script lang="ts">
  /**
   * 챔피언 · 메타 — 라인 링크 줄(전체 · 탑 … 서폿, 라우트 `#/champions/meta/라인`) 아래 이름 있는 범위 둘:
   * 챔피언 메타 표(챔피언 · [라인] · 판 · 승률 · KDA · 분당 딜, 판수 내림차순)와 그 아래 **챔피언 폭** 표
   * (멤버 × 라인 · 판 · 챔피언 종류 · 챔피언 폭). 라인 하나를 선택하면 두 표가 함께 그 라인만 보인다.
   *
   * 챔피언 폭 행을 선택하면 수식 줄에 근거(`=챔피언 폭(이름 · 탑) 6종 ÷ 6판 = 100%`), 같은 행을 다시
   * 선택하면 그 멤버 화면으로 간다(홈 사다리와 같은 규칙 — 표 셀에는 링크를 넣지 못한다).
   * 챔피언 메타·매치업 표는 선택이 없다(갈 곳이 없다). 행 만들기는 $lib/champions 의 순수 함수.
   */
  import type { GuildPayload, LaneId } from '$lib/data/types';
  import { announce } from '$lib/a11y';
  import { fmtMetric, pct } from '$lib/fmt';
  import { LANE_SEQ, isLaneId, laneKo } from '$lib/lanes';
  import { laneCls, wrCls } from '$lib/member';
  import { mLabel } from '$lib/metrics';
  import { href, memberHref, router } from '$lib/router.svelte';
  import { clearFx, setFx } from '$lib/fx.svelte';
  import { fxPool, metaRows, poolRows, type MetaRow, type PoolRow } from '$lib/champions';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';

  interface Props {
    data: GuildPayload;
    /** 라우트 매개변수 — 라인 id 가 아니면 전체 */
    lane: string;
    /** 승률 채움 문턱(app.minGames) */
    minGames: number;
  }
  let { data, lane, minGames }: Props = $props();

  const L = $derived<LaneId | null>(isLaneId(lane) ? lane : null);
  const meta = $derived(metaRows(data, L));
  const pool = $derived(poolRows(data.fun, L, data.players));
  // 라인 링크의 숫자 — 그 라인에서 쓰인 챔피언 수
  const counts = $derived.by(() => {
    const m = {} as Record<LaneId, number>;
    for (const l of LANE_SEQ) m[l] = 0;
    for (const r of data.champion_meta_lane ?? []) if (isLaneId(r.lane)) m[r.lane]++;
    return m;
  });
  const scope = $derived(L ? laneKo(L) : '전체');

  const metaCols = $derived.by((): Col<MetaRow>[] => {
    const mm = data.metric_meta;
    const out: Col<MetaRow>[] = [{ k: 'name', h: '챔피언', img: (r) => r.champ }];
    if (L) out.push({ k: 'laneOrd', h: '라인', lo: true, fmt: (_v, r) => laneKo(r.lane), cls: (r) => laneCls(r.lane) });
    out.push(
      { k: 'games', h: '판', num: true, bar: true },
      { k: 'winrate', h: mLabel(mm, 'winrate'), num: true, fmt: (v) => pct(v as number), cls: (r) => wrCls(r.winrate, r.games, minGames) },
      { k: 'kda', h: mLabel(mm, 'kda'), num: true, fmt: (v) => fmtMetric('kda', v as number, mm) },
      { k: 'dpm', h: mLabel(mm, 'dpm'), num: true, lo: true, fmt: (v) => fmtMetric('dpm', v as number, mm) },
    );
    return out;
  });
  const poolCols = $derived<Col<PoolRow>[]>([
    { k: 'name', h: '멤버' },
    { k: 'laneOrd', h: '라인', fmt: (_v, r) => laneKo(r.lane), cls: (r) => laneCls(r.lane) },
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

  const BAND: Readonly<Record<LaneId, string>> = { TOP: 'lane-top', JUNGLE: 'lane-jg', MIDDLE: 'lane-mid', BOTTOM: 'lane-bot', UTILITY: 'lane-sup' };
  const say = (l: LaneId | null) => announce(l ? `${laneKo(l)} 챔피언` : '전체 라인 챔피언');
</script>

<div class="meta">
  <nav class="views" aria-label="라인 선택">
    <a class="vb" href={href(['champions', 'meta'])} aria-current={L === null ? 'page' : undefined} onclick={() => say(null)}>전체</a>
    {#each LANE_SEQ as l (l)}
      <a class="vb {BAND[l]}" href={href(['champions', 'meta', l])} aria-current={L === l ? 'page' : undefined} onclick={() => say(l)}>
        {laneKo(l)} <span class="n">{counts[l]}</span>
      </a>
    {/each}
  </nav>

  {#key L}
    <DataTable rows={meta} cols={metaCols} caption="챔피언 메타 · {scope}" sortKey="games" />

    <div class="pool">
      <DataTable rows={pool} cols={poolCols} caption="챔피언 폭 · {scope}" sortKey="games" lowerBetterKeys={LOWER}
                 rowKey={(r) => r.key} selectedKey={selected ?? undefined} {onselect} />
    </div>
  {/key}
  <p class="note">
    챔피언 폭 = 챔피언 종류 수 ÷ 판수. 7판 7종이면 매판 다른 챔피언, 7판 2종이면 한 챔피언에 집중한 것입니다.
    행을 선택하면 계산 근거가 수식 줄에 보이고, 같은 행을 다시 선택하면 그 멤버 화면으로 이동합니다.
  </p>
</div>

<style>
  .meta { display: grid; gap: var(--sp-3); }

  /* 라인 링크 줄 — 홈의 보기 버튼과 같은 어휘(왼쪽 3px 라인 띠 칩). 현재 라인은 선택색 테두리 + 밝은 글자 */
  .views { display: flex; flex-wrap: wrap; gap: var(--sp-1); }
  .vb {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    min-height: 28px;
    padding: 0 var(--sp-2);
    background: var(--sheet);
    color: var(--dim);
    border: 1px solid var(--grid-strong);
    border-left-width: 3px;
    border-left-color: transparent;
    border-radius: var(--r-chip);
    font-size: var(--fs-sm);
    line-height: 1.6;
    text-decoration: none;
    white-space: nowrap;
    transition: background-color .15s ease-out, color .15s ease-out, border-color .15s ease-out;
  }
  .vb:hover { background: var(--raised); color: var(--txt); }
  .vb:active { background: var(--gutter); }
  .vb[aria-current='page'] { background: var(--raised); color: var(--txt); border-color: var(--sel); }
  .vb.lane-top { border-left-color: var(--lane-top); }
  .vb.lane-jg { border-left-color: var(--lane-jg); }
  .vb.lane-mid { border-left-color: var(--lane-mid); }
  .vb.lane-bot { border-left-color: var(--lane-bot); }
  .vb.lane-sup { border-left-color: var(--lane-sup); }
  .vb .n { font-variant-numeric: tabular-nums; }

  .pool { min-width: 0; }
  .note { margin: 0; max-width: 75ch; color: var(--dim); font-size: var(--fs-sm); text-wrap: pretty; }

  @media (pointer: coarse) {
    .vb { min-height: 44px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .vb { transition: none; }
  }
</style>
