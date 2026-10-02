<script lang="ts">
  /**
   * 첫 화면 — 내전 장부의 첫 시트. 위에서부터: 한 줄 메타(평균 시간·갱신 — 경기·멤버 수는 헤더에
   * 이미 있다) → 멤버 시트 한 장 → 안내 한 줄.
   *
   * 멤버 시트는 경기에 나온 멤버 전원을 판수 순으로 늘어놓는다(동률은 이름 순) — 줄 세우는 기준이
   * 활동량이라 실력 대리값이 아니다. 열은 멤버·주 라인·판·승률·KDA·분당 딜·킬 관여. 머리를 눌러
   * 다른 열로 정렬하는 것은 DataTable 기본 기능이다. 행 만들기는 $lib/roster 의 순수 함수.
   *
   * 행 선택은 수식 줄에 근거를 쓴다(`=승률(승 31 · 패 33) → 48% · 64판 · 미드`). 같은 행을 다시
   * 선택(클릭·Enter)하면 멤버 화면으로 간다 — 표 셀은 글자만 그리므로 이름 셀에 링크를 넣지 못했다
   * (DataTable 계약). 소환사명 검색 셀도 같은 곳으로 간다.
   *
   * 폰(≤640px): 390px 에서 넘치는 열은 보조 열(.lo)로 숨긴다.
   */
  import { app } from '$lib/data/store.svelte';
  import { memberHref, router } from '$lib/router.svelte';
  import { setFx } from '$lib/fx.svelte';
  import { durKo, pct, stampFull, stampShort } from '$lib/fmt';
  import { laneKo } from '$lib/lanes';
  import { wrClass } from '$lib/tier';
  import { mLabel } from '$lib/metrics';
  import { laneCls } from '$lib/member';
  import { rosterRows, type RosterRow } from '$lib/roster';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';

  // 홈은 하위 화면이 없다 — 라우터 계약(sub·params)만 받고 쓰지 않는다
  let { sub = '', params = {} }: { sub?: string; params?: Record<string, string> } = $props();

  let selected = $state<string | null>(null);

  const data = $derived(app.data);
  const rows = $derived(rosterRows(data));

  const DASH = '—';
  const numOrDash = (v: unknown) => (v == null ? DASH : String(v));
  const intOrDash = (v: unknown) => (v == null ? DASH : Math.round(Number(v)).toLocaleString('ko-KR'));
  const pctOrDash = (v: unknown) => (v == null ? DASH : pct(Number(v)));
  // 승률 채움: WinRate 셀과 같은 규칙(높음 --win · 낮음 --loss · 문턱 미만은 옅은 글자)
  const WR: Readonly<Record<string, string>> = { 'wr-h': 'win wr-h', 'wr-l': 'loss wr-l', 'wr-dim': 'wr-dim', 'wr-m': '' };
  const wrCls = (r: RosterRow) => (r.winrate == null ? '' : WR[wrClass(r.winrate, r.games, app.minGames)] ?? '');

  const cols = $derived.by((): Col<RosterRow>[] => {
    const meta = data?.metric_meta;
    return [
      { k: 'name', h: '멤버' },
      { k: 'laneOrd', h: '주 라인', nullLast: true, fmt: (_v, r) => (r.lane ? laneKo(r.lane) : DASH), cls: (r) => laneCls(r.lane) },
      { k: 'games', h: '판', num: true },
      { k: 'winrate', h: mLabel(meta, 'winrate'), num: true, nullLast: true, fmt: pctOrDash, cls: wrCls },
      { k: 'kda', h: mLabel(meta, 'kda'), num: true, nullLast: true, fmt: numOrDash },
      { k: 'dpm', h: mLabel(meta, 'dpm'), num: true, nullLast: true, lo: true, fmt: intOrDash },
      { k: 'kp', h: mLabel(meta, 'kp'), num: true, nullLast: true, lo: true, fmt: pctOrDash },
    ];
  });
  // 주 라인은 탑→서폿 순서가 앞선 쪽이 위로 오도록 오름차순이 처음이다
  const LOWER = ['laneOrd'];

  /** 수식 줄 — 선택한 행의 승률 근거. 문턱 미만이면 그 사실을 같이 적는다 */
  function fxFor(r: RosterRow): string {
    const meta = data?.metric_meta;
    const parts = [`${r.games}판`];
    if (r.games < app.minGames) parts.push(`${app.minGames}판 미만`);
    if (r.lane) parts.push(laneKo(r.lane));
    return `=${mLabel(meta, 'winrate')}(승 ${r.wins} · 패 ${r.losses}) → ${pctOrDash(r.winrate)} · ${parts.join(' · ')}`;
  }
  function onselect(r: RosterRow, key: string) {
    if (selected === key) { router.go(memberHref(r.name)); return; }
    selected = key;
    setFx(fxFor(r));
  }
</script>

{#if data}
  <section class="home" aria-labelledby="home-h">
    <h2 id="home-h" class="sr-only">멤버</h2>
    <p class="meta">
      <span>평균 <b class="v">{durKo(data.summary.avg_duration_sec)}</b></span>
      · <time datetime={data.timestamp} title={stampFull(data.timestamp)}>갱신 <b class="v">{stampShort(data.timestamp)}</b></time>
    </p>

    <div class="roster">
      <DataTable {rows} {cols} caption="멤버 · 판수 순" sortKey="games" sortDir={-1} lowerBetterKeys={LOWER}
                 rowKey={(r) => r.key} selectedKey={selected ?? undefined} {onselect} filter={false} />
    </div>

    <p class="note">{app.minGames}판 미만은 승률을 옅게 표시합니다. 같은 행을 다시 선택하면 멤버 화면으로 이동합니다.</p>
  </section>
{/if}

<style>
  .home { display: flex; flex-direction: column; gap: var(--sp-3); }

  /* 한 줄 메타 — 무채색, 큰 숫자 타일 없음 */
  .meta { color: var(--dim); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
  .meta time { color: var(--dim); }
  .meta .v { color: var(--txt); font-weight: 700; }

  /* 표 안 조건부 서식은 DataTable 의 클래스(win·loss·lane-*). 문턱 미만 승률의 옅은 글자만 덧댄다 */
  .roster :global(td.wr-dim) { color: var(--dim); }

  .note { max-width: 75ch; color: var(--dim); font-size: var(--fs-sm); text-wrap: pretty; }
</style>
