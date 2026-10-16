<script lang="ts">
  /**
   * 우리 도형 하나 — `$lib/glyphs` 의 경로를 선으로 그린다. 글자색·글자 크기를 따른다(Icon 과 같은 규칙).
   * 기본은 장식(aria-hidden). 도형이 곧 뜻일 때만 label 을 주면 role="img" 로 읽힌다.
   */
  import { GLYPHS, GLYPH_VIEWBOX, type GlyphName } from '$lib/glyphs';

  interface Props {
    name: GlyphName;
    /** 보조기술이 읽을 이름. 없으면 장식으로 숨긴다 */
    label?: string;
  }
  let { name, label }: Props = $props();
</script>

<svg
  class="glyph"
  viewBox={GLYPH_VIEWBOX}
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  {#each GLYPHS[name] as d, i (i)}<path {d} />{/each}
</svg>

<style>
  .glyph {
    width: 1em;
    height: 1em;
    display: inline-block;
    vertical-align: -.15em;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.9;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
