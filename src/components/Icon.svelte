<script lang="ts">
  /**
   * 아이콘 하나 — 옛 `ico(n, cls)` 헬퍼와 `<svg class="ic"><use href="#i-…"/></svg>` 를 이것 하나로 합쳤다.
   * 스프라이트(<use>) 대신 사전의 마크업을 바로 꽂는다: 라우트 청크마다 스프라이트를 심을 필요가 없고,
   * 이름이 IconName 으로 좁혀져 없는 아이콘은 svelte-check 가 잡는다.
   *
   * 기본은 장식(aria-hidden). 옛 순위 메달처럼 아이콘이 곧 뜻일 때만 label 을 주면 role="img" 로 읽힌다.
   */
  import { ICONS, ICON_VIEWBOX, type IconName } from '$lib/icons';

  interface Props {
    name: IconName;
    /** 추가 클래스 — 크기·색은 부모가 `:global(.ic)` 나 이 클래스로 정한다 */
    class?: string;
    /** 보조기술이 읽을 이름. 없으면 장식으로 숨긴다 */
    label?: string;
  }
  let { name, class: cls = '', label }: Props = $props();
</script>

<svg
  class={['ic', cls]}
  viewBox={ICON_VIEWBOX}
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>{@html ICONS[name]}</svg>

<style>
  /* 글자색을 따르고 글자 크기에 맞춘다 — 옛 .ic 규칙 그대로. 선 굵기는 사전 전체가 1.75 하나. */
  .ic {
    width: 1em;
    height: 1em;
    display: inline-block;
    vertical-align: -.15em;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
