<script lang="ts">
  /**
   * 멤버 · MMR 검산 — 경기별 리플레이를 격자로. 손으로 더하면 MMR·CP 가 그대로 나와야 한다.
   *
   * 마지막에 합계 행(Σ ΔMMR·Σ ΔCP 와 base + Σ)을 같은 표 안에 둔다 — 스프레드시트의 SUM 행처럼
   * 열이 맞아야 읽힌다. 합계가 표시 MMR·CP 와 어긋나면 '검산 불일치' 경고 행이 그 아래 붙는다.
   * 행을 선택하면 수식 줄에 그 행의 계산 근거(`=K × ((결과 − E) + 조정) = ΔMMR`), 합계 행이면
   * `=SUM(ΔMMR) …`. 이 화면이 열릴 때는 합계 근거가 먼저 보인다. 선택한 경기의 상세 링크는 표 위 한 줄.
   *
   * 정렬·접기·거르기는 끈다 — 시간순이 곧 검산 순서고, 합계 행이 중간에 끼거나 접히면 안 된다.
   */
  import type { GuildPayload, PlayerPub } from '$lib/data/types';
  import type { Col } from '$lib/table';
  import { dateTimeKo, pct, sgn } from '$lib/fmt';
  import { laneKo } from '$lib/lanes';
  import { matchHref } from '$lib/router.svelte';
  import { setFx } from '$lib/fx.svelte';
  import { fxReplayRow, fxReplaySum, laneCls, replayCheck, replayRows, type ReplayRow } from '$lib/member';
  import DataTable from '$components/DataTable.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import Icon from '$components/Icon.svelte';

  interface Props { key: string; p: PlayerPub; data: GuildPayload }
  let { key, p, data }: Props = $props();

  /** 표의 행 — 경기 행이거나 합계·경고 행. 합계·경고 행은 경기 필드가 비어 있다. */
  type Row = Partial<ReplayRow> & { id: string; kind: 'game' | 'total' | 'warn'; label?: string };

  const cp = $derived(data.cp?.[key]);
  const K = $derived(data.cp_constants);
  const mmrBase = $derived(K?.mmr_base ?? 1000);
  const cpBase = $derived(K?.cp_base ?? 1000);
  const games = $derived(replayRows(cp));
  const chkM = $derived(replayCheck(cp, mmrBase, 'd_mmr'));
  const chkC = $derived(replayCheck(cp, cpBase, 'd_cp'));

  const rows = $derived.by((): Row[] => {
    const out: Row[] = games.map((g) => ({ ...g, id: g.m, kind: 'game' }));
    if (!out.length) return out;
    out.push({ id: 'total', kind: 'total', label: '합계', d_mmr: chkM.sum, mmr: chkM.total, d_cp: chkC.sum, cp: chkC.total });
    if (!chkM.ok || !chkC.ok) {
      out.push({
        id: 'warn', kind: 'warn',
        label: `검산 불일치 · 표시 MMR ${chkM.shown} · CP ${chkC.shown}`,
        mmr: chkM.shown, cp: chkC.shown,
      });
    }
    return out;
  });

  const isGame = (r: Row) => r.kind === 'game';
  const numOr = (digits: number) => (v: unknown, r: Row) => (v == null || !isGame(r) ? '' : Number(v).toFixed(digits));
  const cols: Col<Row>[] = [
    { k: 'ts', h: '시각', sortable: false, fmt: (v, r) => (isGame(r) ? dateTimeKo(Number(v)) : (r.label ?? '')) },
    { k: 'lane', h: '라인', sortable: false, fmt: (v, r) => (isGame(r) ? laneKo(String(v)) : ''), cls: (r) => (isGame(r) ? laneCls(r.lane) : '') },
    { k: 'res', h: '결과', sortable: false, fmt: (v) => (v == null ? '' : String(v)), cls: (r) => (r.win == null ? '' : r.win ? 'win' : 'loss') },
    { k: 'avg_me', h: '우리', num: true, lo: true, sortable: false, fmt: numOr(0) },
    { k: 'avg_opp', h: '상대', num: true, lo: true, sortable: false, fmt: numOr(0) },
    { k: 'e', h: 'E', num: true, sortable: false, fmt: (v, r) => (v == null || !isGame(r) ? '' : pct(Number(v))) },
    { k: 'k', h: 'K', num: true, sortable: false, fmt: numOr(0) },
    { k: 'contrib', h: '기여도', num: true, lo: true, sortable: false, fmt: numOr(2) },
    { k: 'adj', h: '조정', num: true, sortable: false, fmt: (v, r) => (v == null || !isGame(r) ? '' : sgn(Number(v))) },
    { k: 'd_mmr', h: 'ΔMMR', num: true, sortable: false, fmt: (v) => (v == null ? '' : sgn(Number(v), 2)) },
    { k: 'mmr', h: 'MMR', num: true, sortable: false, fmt: (v, r) => (v == null ? '' : Number(v).toFixed(r.kind === 'warn' ? 0 : 1)) },
    { k: 'd_cp', h: 'ΔCP', num: true, sortable: false, fmt: (v) => (v == null ? '' : sgn(Number(v), 2)) },
    { k: 'cp', h: 'CP', num: true, sortable: false, fmt: (v, r) => (v == null ? '' : Number(v).toFixed(r.kind === 'warn' ? 0 : 1)) },
  ];

  let selected = $state('');
  const selGame = $derived(games.find((g) => g.m === selected) ?? null);

  function onselect(r: Row, id: string) {
    selected = id;
    if (r.kind === 'game') setFx(fxReplayRow(r as ReplayRow));
    else setFx(fxReplaySum(chkM, mmrBase));
  }

  // 이 화면이 열릴 때(멤버가 바뀔 때도) 합계 근거를 수식 줄에
  $effect(() => {
    void key;
    selected = '';
    if (games.length) setFx(fxReplaySum(chkM, mmrBase));
  });

  const formula = $derived(
    `ΔMMR = K × ((결과 − E) + 조정) · E = 1 / (1 + 10^((상대 − 우리) / 400)) · 조정 = (기여도 − 1) × ${K?.perf_w ?? '-'} · K: 배치 ${K?.placement_games ?? '-'}판 ${K?.k_place ?? '-'}, 그 뒤 ${K?.k_norm ?? '-'}부터 ${K?.k_decay_half ?? '-'}판마다 절반(최소 ${K?.k_min ?? '-'})`,
  );
</script>

<div class="replay">
  {#if !games.length}
    <EmptyState text="아직 경기 기록이 없습니다." />
  {:else}
    <p class="code fml">{formula}</p>
    <p class="sel" aria-live="polite">
      {#if selGame}
        <span class="muted">선택한 경기 · {dateTimeKo(selGame.ts)} · {laneKo(selGame.lane)} {selGame.res}</span>
        <a href={matchHref(selGame.m)}>경기 상세</a>
      {:else}
        <span class="muted">행을 선택하면 그 경기의 계산 근거가 수식 줄에, 경기 상세 링크가 여기에 보입니다.</span>
      {/if}
    </p>
    <div class="grid">
      <DataTable {rows} {cols} caption="MMR 검산 · {p.name} · {games.length}판"
                 rowKey={(r) => r.id} selectedKey={selected} {onselect}
                 rowClass={(r) => r.kind} fold={false} filter={false} />
    </div>
    {#if !chkM.ok || !chkC.ok}
      <p class="warn" role="alert"><Icon name="alert-triangle" /> 검산 불일치 — 합계와 표시 값이 다릅니다. 발행 데이터를 확인해야 합니다.</p>
    {:else}
      <p class="muted note">합계가 표시 MMR {chkM.shown} · CP {chkC.shown} 과 일치합니다. 순위·밸런스도 같은 숫자를 씁니다.</p>
    {/if}
  {/if}
</div>

<style>
  .replay { display: grid; gap: var(--sp-2); }
  .fml { white-space: normal; line-height: 1.6; padding: var(--sp-2) 0 0; }
  .sel { display: flex; flex-wrap: wrap; gap: var(--sp-2) var(--sp-3); font-size: var(--fs-sm); min-height: 1.5em; }
  .sel a { color: var(--txt); text-underline-offset: .2em; }
  .sel a:hover { background: var(--raised); }
  .note { font-size: var(--fs-sm); }
  .warn { display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-sm); color: var(--txt); }
  /* 합계 행 — 굵게, 홈통 바탕. 경고 행 — 위험 채움(글자는 무채색) */
  .grid :global(tr.total td) { font-weight: 650; background: var(--gutter); }
  .grid :global(tr.warn td) { background: color-mix(in srgb, var(--danger) 18%, transparent); }
</style>
