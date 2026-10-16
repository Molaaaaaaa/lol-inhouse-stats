<script lang="ts">
  /**
   * 챔피언 초상 — ddragon 정사각 아이콘. 장식이라 alt="".
   *
   * 챔피언 id 가 영숫자가 아니면(URL 주입) 아무것도 그리지 않는다. 못 받은 이미지는 main.ts 의
   * 캡처 리스너가 `.champ` 를 숨긴다 — CSP 가 인라인 onerror 를 막으므로 여기서는 손대지 않는다.
   *
   * count(판수)를 주면 40px 이상 초상의 오른쪽 아래 모서리에 숫자 배지를 얹는다(카드의 큰 초상용).
   * 등급·순위 글자가 아니라 사실값(판수)이다. 그보다 작은 초상(표 셀 20px)에는 얹지 않는다 — 초상이 가려지고,
   * 표에는 판수 열이 이미 있다.
   */
  import { safeChamp } from '$lib/data/sanitize';

  interface Props {
    /** 챔피언 id(영문, 예: Ahri) — 한글 이름은 URL 에 못 쓴다 */
    name: string | null | undefined;
    /** ddragon 패치(app.data.patch) */
    patch: string | null | undefined;
    /** 한 변(px). 표 셀 기본 20 */
    size?: number;
    /** 판수 배지 — size ≥ 40 일 때만 그린다 */
    count?: number | null;
  }
  let { name, patch, size = 20, count = null }: Props = $props();

  const BADGE_MIN = 40;

  // 패치도 URL 조각이다 — 숫자·점 밖의 글자가 오면 이미지를 생략한다
  const PATCH = /^[A-Za-z0-9._-]+$/;
  const src = $derived(
    safeChamp(name) && typeof patch === 'string' && PATCH.test(patch)
      ? `https://ddragon.leagueoflegends.com/cdn/${patch}/img/champion/${name}.png`
      : '',
  );
  const badge = $derived(count != null && size >= BADGE_MIN);
</script>

{#if src}
  {#if badge}
    <span class="pw" style:width="{size}px" style:height="{size}px">
      <img class="champ big" {src} loading="lazy" decoding="async" alt="" width={size} height={size} />
      <span class="cnt">{count}<span class="sr-only">판</span></span>
    </span>
  {:else}
    <img class="champ" class:big={size >= BADGE_MIN} {src} loading="lazy" decoding="async" alt="" width={size} height={size} />
  {/if}
{/if}

<style>
  .champ {
    display: inline-block;
    vertical-align: middle;
    flex: none;
    background: var(--ink);
    border-radius: var(--r-xs);
  }
  .big { border-radius: var(--r-md); box-shadow: var(--edge-hi); }
  /* 이미지를 못 받으면 main.ts 가 img 를 숨긴다 — 틀은 빈 초상 자리로 남고 배지(사실값)는 그대로다 */
  .pw { position: relative; display: inline-block; flex: none; vertical-align: middle; background: var(--ink); border-radius: var(--r-md); }
  .pw .champ { display: block; }
  .cnt {
    position: absolute;
    right: -6px;
    bottom: -6px;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    display: inline-grid;
    place-items: center;
    background: var(--raised);
    color: var(--txt);
    border: 1px solid var(--grid-strong);
    border-radius: var(--r-pill);
    font-size: var(--fs-xs);
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
</style>
