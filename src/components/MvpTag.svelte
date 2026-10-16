<script lang="ts">
  /**
   * MVP 표식 — 경기 목록의 멤버 칸과 스코어보드의 멤버 열, 이름 바로 뒤.
   * 뜻은 글자 'MVP' 가 말한다. 모양은 기존 어휘만 쓴다: 700 글자(txt) + 우물(--ink) 바탕 + 1px --grid-strong 테두리, 직각.
   * 의미색·띠·그림자·그라디언트 없음. 이름 사이 간격은 놓인 자리가 정한다.
   */
</script>

<span class="mvp">MVP</span>

<style>
  .mvp {
    flex: none;
    display: inline-block;
    padding: 0 var(--sp-1);
    background: var(--ink);
    color: var(--txt);
    border: 1px solid var(--grid-strong);
    font-size: var(--fs-sm);
    font-weight: 700;
    line-height: 1.4;
    white-space: nowrap;
  }
</style>
