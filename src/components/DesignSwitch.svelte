<script lang="ts">
  /**
   * 디자인 전환 — '디자인 1안 · 2안'. 이중 디자인 빌드(`INHOUSE_SITE_V2=1`, 사이트의 /v2/)에서만 헤더 오른쪽 끝에
   * 붙는다(`main.ts`). 1안 = 사이트 루트의 옛 UI 로 가는 링크, 2안 = 지금 화면(눌린 칩 · `aria-current`, 링크 아님).
   * 옛 UI 쪽 전환과 같은 모양이다. 고른 것을 기억하거나 자동으로 옮기지 않는다 — 링크뿐이다.
   */
</script>

<nav class="design" aria-labelledby="designLab">
  <span class="dlab" id="designLab">디자인</span>
  <a class="chip" href="/">1안</a>
  <span class="chip" aria-current="page">2안</span>
</nav>

<style>
  /* 헤더(flex)의 마지막 칸 — 한 줄이면 도구 단추 오른쪽 */
  .design { flex: none; display: flex; align-items: center; gap: 6px; }
  .dlab { font-size: var(--fs-sm); color: var(--dim); white-space: nowrap; }
  /* 폰: 헤더가 줄을 바꾼다. 이 칸은 상태 글(.meta, order 3) 앞의 한 줄 전체를 쓰고 오른쪽 끝에 붙는다 —
     .meta 와 같은 줄에 서면 폭 0 인 .meta 와의 틈(12px)만큼 도구 단추와 오른쪽 끝이 어긋났다(실측 390px) */
  @media (max-width: 640px) {
    .design { order: 2; flex-basis: 100%; justify-content: flex-end; }
  }
</style>

<!-- 헤더(App 의 요소) 쪽 규칙. 641px 이상에서 헤더는 한 줄(56px)이고 줄을 바꾸지 않는다. 이 칸(143px)이 붙고
     서버 선택까지 보이면(길드 2개 이상) 제목·도구·전환의 합이 폭을 넘어 페이지가 옆으로 밀렸다 — 실측 641px 에서
     701px, 서버 이름이 길면 745px(선택 상자 상한 11rem). 그래서 ① 서버 선택만 줄어들 수 있게 한다(새로고침·피드백·
     이 칸은 그대로, 넘칠 때만 움직인다) ② 641~820px 에서 서버 선택이 있을 때만 '디자인' 글자를 보조기술에만 둔다
     (-45px, 칩과 nav 이름은 그대로). 실측: 641px 에서 선택 상자 117px, 1개 길드·폰 배치는 바뀌지 않는다.
     위 scoped 블록에 :global 로 두지 않는 이유: 그러면 vite-plugin-svelte 가 이 컴포넌트의 CSS 를 꺼진 빌드(지금
     dist)에도 남겨 dist 가 바뀐다(실측). 여기 둔 것은 컴포넌트 템플릿이라 꺼진 빌드에서 통째로 빠진다.
     CSP 는 style-src 'unsafe-inline' 이라 막히지 않는다(site-next/index.html). -->
<svelte:head>
  <style>
    @media (min-width: 641px) {
      header.top .tools { flex-shrink: 1; min-width: 0; }
      header.top select.ctl { min-width: 0; }
    }
    @media (min-width: 641px) and (max-width: 820px) {
      header.top:has(#guildSel) nav.design .dlab {
        position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
        overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
      }
    }
  </style>
</svelte:head>
