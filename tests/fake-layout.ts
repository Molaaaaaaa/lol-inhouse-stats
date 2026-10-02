/**
 * jsdom 은 배치를 안 한다 — 잘림 힌트 테스트용으로 머리 칸(TH)은 100px 씩, 표는 머리 칸 수 × 100px,
 * 가로 스크롤 래퍼(.sheet)는 250px 보이는 폭으로 흉내 낸다. 돌려받은 함수로 원래대로 되돌린다.
 */
export function fakeSheetLayout(): () => void {
  const KEYS = ['offsetWidth', 'offsetLeft', 'offsetHeight', 'clientWidth'] as const;
  const saved = KEYS.map((k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)] as const);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) {
    if (this.tagName === 'TH') return 100;
    if (this.tagName === 'TABLE') return this.querySelectorAll('thead th').length * 100;
    return 0;
  } });
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', { configurable: true, get(this: HTMLElement) {
    return this.tagName === 'TH' ? (this as HTMLTableCellElement).cellIndex * 100 : 0;
  } });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return this.tagName === 'TABLE' ? 300 : 0; } });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get(this: HTMLElement) { return this.classList.contains('sheet') ? 250 : 0; } });
  return () => {
    for (const [k, d] of saved) {
      if (d) Object.defineProperty(HTMLElement.prototype, k, d);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
    }
  };
}
