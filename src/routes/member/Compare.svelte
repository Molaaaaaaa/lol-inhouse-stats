<script lang="ts">
  /**
   * 멤버 · 비교 — 두 멤버 a(왼쪽)·b(오른쪽). 머리를 나란히(이름·티어·주 라인·전적), 가운데 맞대결 스코어.
   * 그 아래 전적 비교표(항목 · a · b)와 라인별 맞대결 목록(라인 · a 챔피언 · b 챔피언 · 승자).
   *
   * 'VS' 는 나란히 놓은 지표가 아니라 **적으로 만났을 때 누가 이겼나**다. 옛 화면의 반반 막대는 넣지 않는다 —
   * 맞대결 0판에서도 50:50 으로 읽혔다(실측 전체 쌍의 37%). 숫자 한 번만.
   */
  import type { GuildPayload, PlayerPub } from '$lib/data/types';
  import type { Col } from '$lib/table';
  import { pct } from '$lib/fmt';
  import { laneKo } from '$lib/lanes';
  import { mLabel } from '$lib/metrics';
  import { memberHref, compareHref } from '$lib/router.svelte';
  import { displayName } from '$lib/data/store.svelte';
  import { h2hFor, laneCls, playerByName, type H2HLaneRow } from '$lib/member';
  import DataTable from '$components/DataTable.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import TierBadge from '$components/TierBadge.svelte';
  import LaneChip from '$components/LaneChip.svelte';
  import WinRate from '$components/WinRate.svelte';

  interface Props { key: string; p: PlayerPub; data: GuildPayload; b: string }
  let { key, p, data, b }: Props = $props();

  const other = $derived(playerByName(data.players, b));
  const same = $derived(other?.key === key);
  const meta = $derived(data.metric_meta);
  const minGames = $derived(data.min_games || 5);
  const aName = $derived(displayName(p));

  const h = $derived(other && !same ? h2hFor(data.h2h, key, other.key) : null);

  interface CmpRow { id: string; item: string; a: string; b: string; better: 'a' | 'b' | '' }
  const cmpRows = $derived.by((): CmpRow[] => {
    if (!other) return [];
    const ra = p.record, rb = other.p.record;
    const ca = data.cp?.[key], cb = data.cp?.[other.key];
    // 큰 쪽을 'win' 채움으로 — 판수는 많다고 좋은 게 아니라 채우지 않는다
    const row = (id: string, item: string, va: number | null | undefined, vb: number | null | undefined, fmt: (v: number) => string, mark = true): CmpRow => ({
      id, item,
      a: va == null ? '-' : fmt(va), b: vb == null ? '-' : fmt(vb),
      better: mark && va != null && vb != null && va !== vb ? (va > vb ? 'a' : 'b') : '',
    });
    const n = (v: number) => String(v);
    return [
      row('games', '판', ra.games, rb.games, n, false),
      row('winrate', mLabel(meta, 'winrate'), ra.winrate, rb.winrate, pct),
      row('kda', mLabel(meta, 'kda'), ra.kda, rb.kda, n),
      row('kp', mLabel(meta, 'kp'), ra.kp, rb.kp, pct),
      row('dpm', mLabel(meta, 'dpm'), ra.dpm, rb.dpm, (v) => Math.round(v).toLocaleString('ko-KR')),
      row('mmr', 'MMR', ca?.mmr, cb?.mmr, n),
    ];
  });
  const cmpCols = $derived<Col<CmpRow>[]>([
    { k: 'item', h: '항목', sortable: false },
    { k: 'a', h: aName, num: true, sortable: false, cls: (r) => (r.better === 'a' ? 'win' : '') },
    { k: 'b', h: b, num: true, sortable: false, cls: (r) => (r.better === 'b' ? 'win' : '') },
  ]);

  type VsRow = H2HLaneRow & { id: string; winner: 'a' | 'b'; who: string; same: string };
  const vsRows = $derived.by((): VsRow[] =>
    (h?.lanes ?? []).map((L, i) => ({ ...L, id: String(i), who: L.aWin ? aName : b, same: L.sameLane ? '같은 라인' : '' })),
  );
  const vsCols = $derived<Col<VsRow>[]>([
    { k: 'lane', h: '라인', fmt: (v) => laneKo(String(v)), cls: (r) => laneCls(r.lane) },
    { k: 'aChamp', h: `${aName} 챔피언`, img: (r) => r.aChamp, fmt: (v) => data.champ_ko?.[String(v)] ?? String(v) },
    { k: 'bChamp', h: `${b} 챔피언`, img: (r) => r.bChamp, fmt: (v) => data.champ_ko?.[String(v)] ?? String(v) },
    { k: 'same', h: '맞라인', lo: true },
    { k: 'who', h: '승자', cls: (r) => (r.aWin ? 'win' : 'loss') },
  ]);
</script>

<div class="compare">
  {#if !other}
    <EmptyState text="비교 대상이 없습니다. 위의 비교 칸에서 다른 멤버를 찾을 수 있습니다." />
  {:else if same}
    <EmptyState text="같은 멤버입니다. 위의 비교 칸에서 다른 멤버를 찾을 수 있습니다." />
  {:else}
    {@const ca = data.cp?.[key]}
    {@const cb = data.cp?.[other.key]}
    {@const need = data.cp_constants?.placement_games ?? 5}
    <div class="head">
      {#each [{ n: aName, r: p.record, c: ca, side: 'a' }, { n: b, r: other.p.record, c: cb, side: 'b' }] as s (s.side)}
        <div class="who" class:right={s.side === 'b'}>
          <h2><a href={memberHref(s.n)}>{s.n}</a></h2>
          <div class="tags">
            {#if s.c}
              <TierBadge cp={s.c.cp} placed={s.c.placed} games={s.c.games} placementGames={need} data={data} tier={s.c.placed ? s.c.tier : undefined} />
              <LaneChip lane={s.c.main_lane} />
            {/if}
          </div>
          <p class="rec">
            <span>{s.r.games}판 {s.r.wins}승 {s.r.losses}패</span>
            <WinRate w={s.r.winrate} n={s.r.games} {minGames} />
          </p>
        </div>
        {#if s.side === 'a'}
          <div class="score">
            <div class="vs">{h && h.vs ? `${h.aWins} : ${h.bWins}` : '-'}</div>
            <div class="muted">맞대결 {h?.vs ?? 0}판</div>
            {#if h && h.withGames}
              <div class="muted">같은 팀 {h.withGames}판 · {mLabel(meta, 'winrate')} {pct(h.withWinrate)}</div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
    <p class="links">
      <a href={compareHref(b, aName)}>좌우 바꾸기</a>
      <a href={memberHref(aName)}>비교 해제</a>
    </p>

    <DataTable rows={cmpRows} cols={cmpCols} caption="전적 비교" rowNumbers={false} rowKey={(r) => r.id} fold={false} filter={false} />

    {#if h && h.vs}
      <DataTable rows={vsRows} cols={vsCols} caption="맞대결 · {h.vs}판" rowKey={(r) => r.id} />
    {:else}
      <EmptyState text="아직 맞대결 기록이 없습니다." />
    {/if}
  {/if}
</div>

<style>
  .compare { display: grid; gap: var(--sp-4); }
  .head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: var(--sp-3);
    align-items: start;
    border: 1px solid var(--grid);
    padding: var(--sp-3);
  }
  .who { min-width: 0; display: grid; gap: var(--sp-1); }
  .who.right { text-align: right; }
  .who.right .tags, .who.right .rec { justify-content: flex-end; }
  .who h2 { font-size: var(--fs-lg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .who h2 a { text-decoration: none; }
  .who h2 a:hover { text-decoration: underline; text-underline-offset: .2em; }
  .tags, .rec { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); }
  .rec { font-size: var(--fs-sm); }
  .score { text-align: center; font-size: var(--fs-sm); white-space: nowrap; }
  .vs { font-size: var(--fs-num); font-weight: 700; font-variant-numeric: tabular-nums; }
  .links { display: flex; gap: var(--sp-3); font-size: var(--fs-sm); }
  .links a { color: var(--dim); text-underline-offset: .2em; }
  .links a:hover { color: var(--txt); background: var(--raised); }
  @media (max-width: 640px) {
    .head { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .score { grid-column: 1 / -1; order: 3; border-top: 1px solid var(--grid); padding-top: var(--sp-2); }
  }
</style>
