/**
 * 화면 폭 상태 — `media.phone` 은 ≤640px(폰) 인가. CSS 미디어 쿼리와 같은 경계다.
 *
 * CSS 로 못 하는 것에만 쓴다: 열 스펙 자체를 바꾸는 경우(순위 열을 정렬 기준에서 빼기·라인 셀의
 * ' · 주' 생략·히트맵 머리 약칭). 보이고 숨기는 것은 여전히 CSS(`.lo`)가 한다.
 * jsdom 은 matchMedia 흉내가 늘 false 라 테스트는 `media.phone = true` 로 직접 놓는다.
 */
export const PHONE_QUERY = '(max-width: 640px)';

export const media = $state({ phone: false });

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const mq = window.matchMedia(PHONE_QUERY);
  const sync = () => { media.phone = !!mq.matches; };
  sync();
  // change 와 resize 둘 다 듣는다 — 일부 환경(뷰포트 에뮬레이션)은 change 를 안 보낸다
  mq.addEventListener?.('change', sync);
  window.addEventListener('resize', sync, { passive: true });
}
