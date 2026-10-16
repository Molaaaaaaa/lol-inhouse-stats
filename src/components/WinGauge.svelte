<script lang="ts">
  /**
   * 승률 게이지 — 둘로 나뉜 막대(승 조각 하늘색 그라디언트 · 2px 틈 · 패 조각 주홍 사선 무늬, 가운데 50% 눈금)와
   * 승률 글자(승률 단계 색 + ▲▼ 기호). 패 쪽도 채운다 — 승만 채우고 패를 빈 트랙으로 두면 '몇 판 중'이 안 보인다.
   *
   * 변형(variant):
   * - full: 머리에 28px 승률 + 'n승 n패 · n판', 아래 8px 막대(멤버 히어로).
   * - row: 한 줄 — 승률 · 막대 · 'n승 n패'(표 셀, 문턱 미만이면 '표본 적음'). 칸 폭을 고정해 행마다 막대가 같은 자리다.
   *   본문 폭(--wrap 1100px) 아래에서는 두 줄로 쌓는다: 승률 아래 40px 막대, 승패 글은 숨긴다 — 한 줄(약 220px)이면
   *   열 많은 표(판수 순위 13열)의 승률 열이 태블릿 폭에서 가로 스크롤 뒤로 밀렸다(실측 820·900·1024px).
   *   문턱 미만이면 막대 자리에 '표본 적음'을 글로 둔다 — 쌓인 꼴에서도 색(옅은 글자)만으로 가르지 않는다.
   * - bar: 막대만(카드 안 보조 표시). 폭은 부모가 정한다.
   *
   * 단계는 `$lib/tier` 의 wrStep(Wilson 구간 기준) — 판수가 문턱 미만이면 무채색 + '표본 적음'.
   * 첫 채움 애니메이션은 없다(라우트에 들어올 때마다 표 37행이 다시 채워진다 — 비평 반영).
   * 접근성: 전체가 role="img" 하나이고 이름에 숫자를 다 담는다('승률 54%, 46승 40패, 86판').
   * 표 셀 안에서는 DataTable 이 셀 스니펫을 aria-hidden 으로 감싸고 fmt 글자를 대신 읽힌다.
   */
  import { pct } from '$lib/fmt';
  import { WR_MARK, WR_WORD, wrStep } from '$lib/tier';

  interface Props {
    /** 승률 0~1 */
    w: number;
    /** 판수 */
    n: number;
    /** 문턱(app.minGames · app.minGamesLane) */
    minGames: number;
    variant?: 'full' | 'row' | 'bar';
  }
  let { w, n, minGames, variant = 'row' }: Props = $props();

  const games = $derived(Math.max(0, Math.round(n || 0)));
  const wins = $derived(Math.min(games, Math.max(0, Math.round((w || 0) * games))));
  const losses = $derived(games - wins);
  const step = $derived(wrStep(w, games, minGames));
  /** 승패 글 — row 는 칸 폭을 행마다 같게 두려고 문턱 미만이면 '표본 적음'만(승패는 이름·판 열에 있다) */
  const wl = $derived(
    variant === 'row' && step === 'few'
      ? WR_WORD.few
      : `${wins}승 ${losses}패${variant === 'full' ? ` · ${games}판` : ''}${step === 'few' ? ` · ${WR_WORD.few}` : ''}`,
  );
  const label = $derived(
    games === 0
      ? '승률 기록 없음'
      : `승률 ${pct(w)}${WR_WORD[step] ? `, ${WR_WORD[step]}` : ''}, ${wins}승 ${losses}패, ${games}판`,
  );
</script>

<span class="wg v-{variant}" class:few={step === 'few'} role="img" aria-label={label}>
  {#if variant !== 'bar'}
    <span class="pc st-{step}">{games ? pct(w) : '—'}<span class="mk">{WR_MARK[step]}</span></span>
  {/if}
  <span class="gbar">
    <span class="track">
      {#if wins > 0}<span class="seg w" style:flex-grow={wins}></span>{/if}
      {#if losses > 0}<span class="seg l" style:flex-grow={losses}></span>{/if}
    </span>
    <span class="mid"></span>
  </span>
  {#if variant !== 'bar' && games > 0}
    <span class="wl">{wl}</span>
  {/if}
</span>

<style>
  .wg { font-variant-numeric: tabular-nums; }
  .pc { font-weight: 700; white-space: nowrap; }
  .mk { display: inline-block; margin-left: 2px; font-size: .72em; letter-spacing: -.05em; }
  .wl { color: var(--dim); font-size: var(--fs-sm); white-space: nowrap; }

  /* 막대 — 트랙은 둥근 알약(넘침 숨김), 눈금은 그 밖에 겹쳐 위아래로 2px 삐져나온다 */
  .gbar { position: relative; display: block; }
  .track {
    display: flex;
    gap: 2px;
    height: 6px;
    border-radius: var(--r-pill);
    overflow: hidden;
    background: var(--track);
  }
  .seg { flex-basis: 0; min-width: 2px; }
  .seg.w { background: var(--grad-win); }
  .seg.l { background: var(--hatch-loss); }
  .mid {
    position: absolute;
    left: 50%;
    top: -2px;
    bottom: -2px;
    width: 1px;
    background: color-mix(in srgb, var(--txt) 55%, transparent);
  }

  /* row — 표 셀 한 줄. 승률 칸 폭을 고정해 행마다 막대가 같은 자리에서 시작한다 */
  .v-row { display: inline-flex; align-items: center; gap: var(--sp-2); vertical-align: middle; }
  .v-row .pc { min-width: calc(4ch + 1.3em); text-align: right; }
  .v-row .mk { width: 1.3em; text-align: left; }
  .v-row .gbar { flex: none; width: 80px; }
  .v-row .wl { min-width: 4.8em; text-align: left; }

  /* full — 머리 한 줄(큰 승률 + 승패) 아래 8px 막대 */
  .v-full { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: baseline; gap: var(--sp-1) var(--sp-3); }
  .v-full .pc { font-size: var(--fs-hero); line-height: 1.1; }
  .v-full .gbar { grid-column: 1 / -1; grid-row: 2; margin-top: var(--sp-1); }
  .v-full .track { height: 8px; }

  /* bar — 막대만, 부모 폭 */
  .v-bar { display: block; }

  /* 본문 폭 아래(태블릿·폰): 승률 위 · 40px 막대 아래 두 줄로 쌓는다(44px 행 안) — 한 줄로 두면 표 열이 220px 가까이
     먹는다. 문턱 미만은 막대 대신 '표본 적음'(12px 옅은 글자) — 쌓인 꼴은 승패 글을 숨기므로 그 말이 사라지면 색만 남는다 */
  @media (max-width: 1100px) {
    .v-row { display: inline-grid; gap: 3px; justify-items: end; }
    .v-row .pc { min-width: 0; }
    .v-row .mk { width: auto; }
    .v-row .wl { display: none; }
    .v-row .gbar { width: 40px; }
    .v-row.few .gbar { display: none; }
    .v-row.few .wl { display: block; min-width: 0; font-size: var(--fs-xs); line-height: 1.4; color: var(--dim2); }
  }
  /* 강제 색상: 그라디언트·무늬가 지워진다 — 시스템 색으로 두 조각을 다시 칠한다(틈과 눈금이 경계를 말한다) */
  @media (forced-colors: active) {
    .track, .mid { forced-color-adjust: none; }
    .track { background: Canvas; outline: 1px solid CanvasText; }
    .seg.w { background: Highlight; }
    .seg.l { background: CanvasText; }
    .mid { background: Canvas; }
  }
</style>
