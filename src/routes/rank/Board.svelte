<script lang="ts">
  /**
   * 판수 순위 · 승률 표 — 보기 칩 줄(라인별(기본) · 통합 · 라인 하나, 라인 칩은 라인 점) → 범위·순위 기준 한 줄 →
   * 카드(Panel) 안의 표 → 안내. 승률 열은 승률 게이지(승률 단계 색 + 기호 · 막대 · 'n승 n패').
   * 보기는 URL(`#/rank/board/:lane?` — 없음=라인별 · all=통합 · 라인 키)이 상태다.
   *
   * 통합은 payload 의 leaderboard(발행 문턱), 라인별은 players[*].lanes(라인 판수 ≥ 라인 문턱).
   * 기본 순서는 판수 내림차순(같으면 이름 오름차순) — 승률·신뢰성은 값으로만 두고 기본 정렬로 쓰지 않는다.
   * 순위는 그 기본 순서(판수) 기준으로 $lib/rank 가 미리 박는다 — 표를 다른 열로 정렬해도 순위는 그대로다. 활동량 순위라 메달(1~3위 막대)은 달지 않는다.
   * 행 선택은 수식 줄에 `=승률(6/6) → 100% · 신뢰성 61%`, 같은 행을 다시 선택하면 멤버 화면(표 셀은 글자만 — DataTable 계약).
   */
  import { app } from '$lib/data/store.svelte';
  import { href, memberHref, router } from '$lib/router.svelte';
  import { announce } from '$lib/a11y';
  import { clearFx, setFx } from '$lib/fx.svelte';
  import { pct } from '$lib/fmt';
  import { LANE_SEQ, laneKo } from '$lib/lanes';
  import { minGamesNote, wrText } from '$lib/tier';
  import { mLabel } from '$lib/metrics';
  import { boardLaneCounts, boardRows, boardViewOf, type BoardRow, type BoardView } from '$lib/rank';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';
  import LaneChip from '$components/LaneChip.svelte';
  import Panel from '$components/Panel.svelte';
  import QMark from '$components/Tooltip.svelte';
  import Skeleton from '$components/Skeleton.svelte';
  import WinGauge from '$components/WinGauge.svelte';

  let { params = {} }: { params?: Record<string, string> } = $props();

  const data = $derived(app.data);
  const view = $derived(boardViewOf(params.lane));
  const rows = $derived(data ? boardRows(data, view, app.minGamesLane) : []);
  const counts = $derived(data ? boardLaneCounts(data, app.minGamesLane) : null);
  const note = $derived(minGamesNote(data, view !== 'all'));
  const need = $derived(view === 'all' ? app.minGames : app.minGamesLane);

  let selected = $state<string | null>(null);
  // 보기가 바뀌면(버튼·뒤로 가기 모두 URL 로 온다) 선택과 수식 줄을 비운다 — 지난 표의 근거가 남지 않게
  $effect(() => {
    void view;
    selected = null;
    clearFx();
  });

  const DASH = '—';
  const numOrDash = (v: unknown) => (v == null ? DASH : String(v));
  const intOrDash = (v: unknown) => (v == null ? DASH : Math.round(Number(v)).toLocaleString('ko-KR'));
  const pctOrDash = (v: unknown) => (v == null ? DASH : pct(Number(v)));

  const cols = $derived.by((): Col<BoardRow>[] => {
    const meta = data?.metric_meta;
    const all = view === 'all';
    const out: Col<BoardRow>[] = [
      { k: 'name', h: '멤버' },
      { k: 'rank', h: '판수 순위', num: true, nullLast: true, fmt: numOrDash },
    ];
    if (view === 'lanes') out.push({ k: 'laneOrd', h: '라인', cell: laneCell, fmt: (_v, r) => laneKo(r.lane) });
    // 폰에서는 승도 보조 열(.lo) — 승률 게이지가 승패 몫을 막대로 보이고, 카드(Panel) 안쪽 여백만큼 좁아진 390px 에서
    // 승률 열이 12px 잘렸다(실측). 승수는 보조기술 글·태블릿 이상에는 그대로 있다
    out.push(
      { k: 'games', h: '판', num: true },
      { k: 'wins', h: '승', num: true, lo: true },
      { k: 'losses', h: '패', num: true, lo: true },
      { k: 'winrate', h: mLabel(meta, 'winrate'), num: true, cell: wrGauge, fmt: (_v, r) => wrText(r.winrate, r.games, need) },
      { k: 'ci', h: '신뢰성', num: true, lo: true, hlp: '신뢰성', fmt: pctOrDash },
      { k: 'kda', h: mLabel(meta, 'kda'), num: true, lo: true, fmt: numOrDash },
      { k: 'kp', h: mLabel(meta, 'kp'), num: true, lo: true, fmt: pctOrDash },
      { k: 'dpm', h: mLabel(meta, 'dpm'), num: true, bar: true, lo: true, fmt: intOrDash },
    );
    if (!all) {
      out.push(
        { k: 'cs', h: '판당 CS', num: true, lo: true, fmt: intOrDash },
        { k: 'vision', h: mLabel(meta, 'vision'), num: true, lo: true, fmt: intOrDash },
      );
    }
    return out;
  });
  const LOWER = ['rank', 'laneOrd'];

  const VIEW_LABEL: Readonly<Record<'lanes' | 'all', string>> = { lanes: '라인별', all: '통합' };
  const viewLabel = (v: BoardView) => (v === 'lanes' || v === 'all' ? VIEW_LABEL[v] : laneKo(v));
  const caption = $derived(`판수 순위 · ${mLabel(data?.metric_meta, 'winrate')} · ${viewLabel(view)}`);
  const hrefOf = (v: BoardView) => (v === 'lanes' ? href(['rank', 'board']) : href(['rank', 'board', v]));

  function setView(v: BoardView) {
    if (view === v) return;
    announce(`${viewLabel(v)} 리더보드`);
    router.go(hrefOf(v));
  }

  // 표 위 한 줄 — 이 표에 누가 몇 줄 있고, 순위가 무엇 기준인지
  const scopeNote = $derived.by(() => {
    const n = rows.length;
    const head = view === 'lanes'
      ? `멤버 × 라인 ${n}줄 · 라인 ${app.minGamesLane}판 이상`
      : view === 'all'
        ? `${n}명 · 전체 경기 기준`
        : `${laneKo(view)} ${app.minGamesLane}판 이상 출전한 ${n}명 · ${laneKo(view)} 경기만 집계`;
    return `${head}. 순위는 판수 기준입니다.`;
  });

  /** 수식 줄 — 승률의 계산 근거. 라인별 행은 어느 라인 판인지 같이 적는다 */
  function fxFor(r: BoardRow): string {
    const lane = r.lane ? `${laneKo(r.lane)} ` : '';
    return `=승률(${lane}${r.wins}/${r.games}) → ${pct(r.winrate)} · 신뢰성 ${pct(r.ci)}`;
  }
  function onselect(r: BoardRow, key: string) {
    if (selected === key) { router.go(memberHref(r.name)); return; }
    selected = key;
    setFx(fxFor(r));
  }
</script>

{#snippet wrGauge(r: BoardRow)}<WinGauge w={r.winrate} n={r.games} minGames={need} />{/snippet}
{#snippet laneCell(r: { lane?: string | null })}<LaneChip lane={r.lane} />{/snippet}

{#if data}
  <div class="board">
    <div class="chips" role="group" aria-label="리더보드 보기">
      <button type="button" class="chip" aria-pressed={view === 'lanes'} onclick={() => setView('lanes')}>라인별</button>
      <button type="button" class="chip" aria-pressed={view === 'all'} onclick={() => setView('all')}>통합</button>
      {#each LANE_SEQ as l (l)}
        <button type="button" class="chip" aria-pressed={view === l} onclick={() => setView(l)}>
          <LaneChip lane={l} games={counts?.[l] ?? 0} />
        </button>
      {/each}
    </div>

    <p class="note">{scopeNote}</p>

    <Panel title={caption} level={3}>
      {#key view}
        <DataTable {rows} {cols} {caption} captionHidden sortKey="rank" sortDir={1} lowerBetterKeys={LOWER}
                   rowKey={(r) => r.key} selectedKey={selected ?? undefined} {onselect} />
      {/key}
      <p class="note in">신뢰성(승률의 Wilson 하한)은 열 머리를 선택하면 그 값으로 정렬합니다. 같은 행을 다시 선택하면 멤버 화면으로 이동합니다.
        승률의 색과 ▲▼는 판수를 감안해도 50%와 차이가 날 때만 붙고, 문턱 미만은 '표본 적음'으로 적습니다.</p>
      {#if note}
        <p class="note in">{note.text} <QMark text={note.tip} label={note.tipLabel} /></p>
      {/if}
    </Panel>
  </div>
{:else}
  <Skeleton rows={8} />
{/if}

<style>
  .board { display: flex; flex-direction: column; gap: var(--sp-3); }

  .note { max-width: 75ch; color: var(--dim); font-size: var(--fs-sm); text-wrap: pretty; }
  .note.in { padding-top: var(--sp-2); }
</style>
