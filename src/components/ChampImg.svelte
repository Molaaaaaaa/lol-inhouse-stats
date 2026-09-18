<script lang="ts">
  /**
   * 챔피언 초상 — ddragon 정사각 아이콘. 장식이라 alt="".
   *
   * 챔피언 id 가 영숫자가 아니면(URL 주입) 아무것도 그리지 않는다. 못 받은 이미지는 main.ts 의
   * 캡처 리스너가 `.champ` 를 숨긴다 — CSP 가 인라인 onerror 를 막으므로 여기서는 손대지 않는다.
   */
  import { safeChamp } from '$lib/data/sanitize';

  interface Props {
    /** 챔피언 id(영문, 예: Ahri) — 한글 이름은 URL 에 못 쓴다 */
    name: string | null | undefined;
    /** ddragon 패치(app.data.patch) */
    patch: string | null | undefined;
    /** 한 변(px). 표 셀 기본 20 */
    size?: number;
  }
  let { name, patch, size = 20 }: Props = $props();

  // 패치도 URL 조각이다 — 숫자·점 밖의 글자가 오면 이미지를 생략한다
  const PATCH = /^[A-Za-z0-9._-]+$/;
  const src = $derived(
    safeChamp(name) && typeof patch === 'string' && PATCH.test(patch)
      ? `https://ddragon.leagueoflegends.com/cdn/${patch}/img/champion/${name}.png`
      : '',
  );
</script>

{#if src}
  <img class="champ" {src} loading="lazy" decoding="async" alt="" width={size} height={size} />
{/if}

<style>
  .champ {
    display: inline-block;
    vertical-align: middle;
    flex: none;
    background: var(--ink);
    border-radius: var(--r-chip);
  }
</style>
