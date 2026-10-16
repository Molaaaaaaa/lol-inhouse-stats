<script lang="ts">
  /**
   * 카드(바깥 카드) — 한 화면 안의 '이름 있는 범위'(표·차트·목록)를 담는 그릇.
   * 머리: [도형 칩] 제목 ……… [동작 슬롯], 몸통: 내용. 반경 20px · 1px --grid · 위가 밝은 그라디언트 · 위쪽 1px 빛 + 그림자.
   * 안에 놓는 작은 판은 app.css 의 `.tile`(12px) — 두 단 반경이 이 세계의 모양이다.
   *
   * 제목은 h2(기본)·h3 이고 section 의 이름이 된다(aria-labelledby). 단계 규칙은 level 설명. 안의 DataTable 이 같은 말을 캡션으로 가지면
   * DataTable 에 captionHidden 을 줘서 두 번 보이지 않게 한다(캡션은 보조기술에 남고, 잘림 힌트는 보인다).
   * overflow 를 숨기지 않는다 — 숨기면 안의 표 머리행이 문서 스크롤에 붙지 못한다(sticky).
   */
  import type { Snippet } from 'svelte';
  import type { GlyphName } from '$lib/glyphs';
  import Glyph from '$components/Glyph.svelte';

  interface Props {
    title: string;
    /** 제목 단계 — 화면에 숨은 h2(섹션 이름: 멤버·순위·챔피언·시너지·경기·기록·피드백·지표 안내)가 있으면 3, 멤버 화면(h1 = 이름)처럼 없으면 2 */
    level?: 2 | 3;
    /** 제목 앞 도형 칩(장식) */
    glyph?: GlyphName;
    /** 머리 오른쪽 — 버튼·링크·선택 줄 */
    actions?: Snippet;
    children: Snippet;
  }
  let { title, level = 2, glyph, actions, children }: Props = $props();

  const uid = $props.id();
</script>

<section class="panel" aria-labelledby="{uid}-h">
  <div class="ph">
    {#if glyph}<span class="ic"><Glyph name={glyph} /></span>{/if}
    <svelte:element this={level === 3 ? 'h3' : 'h2'} id="{uid}-h" class="pt">{title}</svelte:element>
    {#if actions}<div class="pa">{@render actions()}</div>{/if}
  </div>
  <div class="pb">{@render children()}</div>
</section>

<style>
  .panel {
    min-width: 0;
    background: var(--grad-card);
    border: 1px solid var(--grid);
    border-radius: var(--r-lg);
    box-shadow: var(--edge-hi), var(--shadow-1);
  }
  .ph {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: 44px;
    padding: var(--sp-3) var(--sp-4) var(--sp-2);
  }
  /* 도형 칩 — 무채색(액센트는 선택·초점·활성 독·MVP 에만) */
  .ic {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: var(--r-chip);
    background: var(--raised);
    color: var(--dim);
    font-size: 14px;
  }
  .pt {
    flex: 1 1 auto;
    min-width: 0;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--dim);
  }
  .pa { flex: none; display: flex; align-items: center; gap: var(--sp-2); }
  .pb { padding: 0 var(--sp-4) var(--sp-4); min-width: 0; }

  /* 폰: 표가 쓸 폭을 지킨다(카드 안쪽 여백 16 → 10) */
  @media (max-width: 640px) {
    .ph { padding: 10px 10px 6px; }
    .pb { padding: 0 10px 10px; }
  }
</style>
