/** 보조기술에 상태 변화를 알린다. 같은 문자열을 연속으로 넣으면 다시 안 읽히므로 비웠다 채운다. */
export function announce(msg: string): void {
  const el = document.getElementById('sr');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = msg; }, 50);
}
