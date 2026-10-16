<script lang="ts">
  /**
   * 첫 화면 — 위에서부터: 요약 띠(경기 · 멤버 · 평균 경기 시간 · 최근 갱신) → 멤버 카드(표 한 장) → 안내 한 줄.
   * 요약 띠는 데스크톱에서 타일 네 칸, 폰에서는 한 줄 글로 접힌다(SummaryStrip) — 멤버 목록이 첫 화면에 남게.
   *
   * 멤버 표는 경기에 나온 멤버 전원을 판수 순으로 늘어놓는다(동률은 이름 순) — 줄 세우는 기준이
   * 활동량이라 실력 대리값이 아니다. 열은 멤버 · 주 라인(라인 점 + 이름) · 판 · 승률(게이지) · KDA ·
   * 분당 딜 · 킬 관여 · 최근(연승·연패 알약). 머리를 눌러 다른 열로 정렬하는 것은 DataTable 기본 기능이고,
   * '최근' 은 정렬하지 않는다(연속은 사실 표시일 뿐 줄 세울 값이 아니다). 행 만들기는 $lib/roster 의 순수 함수.
   *
   * 승률 게이지의 글자색·기호는 Wilson 구간 기준 단계(wrStep) — 구간이 50% 를 벗어날 때만 색이 있다.
   * 그림 셀(게이지·알약·라인 점)은 DataTable 이 aria-hidden 으로 감싸고 fmt 글자를 대신 읽힌다.
   *
   * 행 선택은 수식 줄에 근거를 쓴다(`=승률(승 31 · 패 33) → 48% · 64판 · 미드`). 같은 행을 다시
   * 선택(클릭·Enter)하면 멤버 화면으로 간다 — 표 셀에는 링크를 넣지 않는다(DataTable 계약).
   * 소환사명 검색 셀도 같은 곳으로 간다.
   *
   * 폰(≤640px): 390px 에서 넘치는 열은 보조 열(.lo)로 숨긴다(분당 딜 · 킬 관여 · 최근).
   */
  import { app } from '$lib/data/store.svelte';
  import { memberHref, router } from '$lib/router.svelte';
  import { setFx } from '$lib/fx.svelte';
  import { mmss, pct, stampFull, stampShort } from '$lib/fmt';
  import { laneKo } from '$lib/lanes';
  import { mLabel } from '$lib/metrics';
  import { gaugeText } from '$lib/member';
  import { rosterRows, streakText, type RosterRow } from '$lib/roster';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';
  import Panel from '$components/Panel.svelte';
  import SummaryStrip, { type SummaryItem } from '$components/SummaryStrip.svelte';
  import WinGauge from '$components/WinGauge.svelte';
  import StreakPill from '$components/StreakPill.svelte';
  import LaneChip from '$components/LaneChip.svelte';

  // 홈은 하위 화면이 없다 — 라우터 계약(sub·params)만 받고 쓰지 않는다
  let { sub = '', params = {} }: { sub?: string; params?: Record<string, string> } = $props();

  let selected = $state<string | null>(null);

  const data = $derived(app.data);
  const rows = $derived(rosterRows(data));

  const DASH = '—';
  const numOrDash = (v: unknown) => (v == null ? DASH : String(v));
  const intOrDash = (v: unknown) => (v == null ? DASH : Math.round(Number(v)).toLocaleString('ko-KR'));
  const pctOrDash = (v: unknown) => (v == null ? DASH : pct(Number(v)));

  /** 요약 띠 네 칸 — 폰 한 줄은 '111판 · 37명 · 평균 27:47 · 갱신 10/1 16:27' */
  const summary = $derived.by((): SummaryItem[] => {
    if (!data) return [];
    const s = data.summary;
    const avg = s.avg_duration_sec ? mmss(s.avg_duration_sec) : '-';
    const at = stampShort(data.timestamp);
    return [
      { label: '경기', value: s.total_games.toLocaleString('ko-KR'), unit: '판' },
      { label: '멤버', value: s.player_count.toLocaleString('ko-KR'), unit: '명' },
      { label: '평균 경기 시간', value: avg, short: `평균 ${avg}` },
      { label: '최근 갱신', value: at, short: `갱신 ${at}`, datetime: data.timestamp, title: stampFull(data.timestamp) || undefined },
    ];
  });

  const cols = $derived.by((): Col<RosterRow>[] => {
    const meta = data?.metric_meta;
    return [
      { k: 'name', h: '멤버' },
      { k: 'laneOrd', h: '주 라인', nullLast: true, cell: laneCell, fmt: (_v, r) => (r.lane ? laneKo(r.lane) : DASH) },
      { k: 'games', h: '판', num: true },
      { k: 'winrate', h: mLabel(meta, 'winrate'), num: true, nullLast: true, cell: gaugeCell,
        fmt: (_v, r) => (r.winrate == null ? DASH : gaugeText(r.winrate, r.games, app.minGames)) },
      { k: 'kda', h: mLabel(meta, 'kda'), num: true, nullLast: true, fmt: numOrDash },
      { k: 'dpm', h: mLabel(meta, 'dpm'), num: true, nullLast: true, lo: true, fmt: intOrDash },
      { k: 'kp', h: mLabel(meta, 'kp'), num: true, nullLast: true, lo: true, fmt: pctOrDash },
      { k: 'form', h: '최근', sortable: false, lo: true, cell: streakCell, fmt: (_v, r) => streakText(r.form, r.games) },
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

{#snippet laneCell(r: RosterRow)}{#if r.lane}<LaneChip lane={r.lane} />{:else}{DASH}{/if}{/snippet}
{#snippet gaugeCell(r: RosterRow)}{#if r.winrate != null}<WinGauge w={r.winrate} n={r.games} minGames={app.minGames} />{:else}{DASH}{/if}{/snippet}
{#snippet streakCell(r: RosterRow)}<StreakPill form={r.form} games={r.games} />{/snippet}

{#if data}
  <section class="home" aria-labelledby="home-h">
    <h2 id="home-h" class="sr-only">멤버</h2>
    <SummaryStrip items={summary} />

    <Panel title="멤버 · 판수 순" level={3} glyph="duo">
      <DataTable {rows} {cols} caption="멤버 · 판수 순" captionHidden sortKey="games" sortDir={-1} lowerBetterKeys={LOWER}
                 rowKey={(r) => r.key} selectedKey={selected ?? undefined} {onselect} filter={false} />
      <p class="note">{app.minGames}판 미만의 승률은 옅게 '표본 적음'으로 적고, 색과 ▲▼는 판수를 감안해도 50%와 차이가 날 때만 붙습니다. 같은 행을 다시 선택하면 멤버 화면으로 이동합니다.</p>
    </Panel>
  </section>
{/if}

<style>
  .home { display: flex; flex-direction: column; gap: var(--sp-4); }

  .note { max-width: 75ch; padding-top: var(--sp-3); color: var(--dim); font-size: var(--fs-sm); text-wrap: pretty; }

  /* 폰: 요약 줄과 카드 사이를 좁혀 첫 화면에 멤버 행을 더 남긴다 */
  @media (max-width: 640px) {
    .home { gap: var(--sp-2); }
    .note { padding-top: var(--sp-2); }
  }
</style>
