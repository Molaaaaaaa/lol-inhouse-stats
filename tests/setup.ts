// jsdom 에 없는 브라우저 API — 컴포넌트가 mount 될 때 필요하다
import { vi } from 'vitest';

class IO {
  constructor(private cb: IntersectionObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
  // 테스트가 "보인다" 신호를 흉내 낼 때 쓴다
  trigger(entries: Partial<IntersectionObserverEntry>[]) { this.cb(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver); }
}
Object.defineProperty(globalThis, 'IntersectionObserver', { value: IO, writable: true });
Object.defineProperty(globalThis, 'ResizeObserver', { value: class { observe() {} unobserve() {} disconnect() {} }, writable: true });
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
  }));
}
window.scrollTo = vi.fn();
