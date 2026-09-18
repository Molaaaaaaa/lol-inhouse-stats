import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import SheetTabs from '../src/components/SheetTabs.svelte';
import { NAV } from '../src/lib/nav';
import { router } from '../src/lib/router.svelte';

/** hashchange 는 jsdom 에서 비동기라 해시를 놓고 start() 로 바로 읽힌다 */
function at(hash: string) {
  location.hash = hash;
  router.stop();
  router.start();
}
const links = () => screen.getAllByRole('link') as HTMLAnchorElement[];
const current = () => links().filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent);

describe('SheetTabs', () => {
  beforeEach(() => { cleanup(); at(''); });

  it('<nav aria-label="주 메뉴"> 안에 NAV 6개가 순서대로 링크(a href)로 있다', () => {
    render(SheetTabs);
    const nav = screen.getByRole('navigation', { name: '주 메뉴' });
    const as = [...nav.querySelectorAll('a')];
    expect(as).toHaveLength(6);
    expect(as.map((a) => a.textContent)).toEqual(NAV.map((n) => n.label));
    expect(as.map((a) => a.getAttribute('href'))).toEqual(NAV.map((n) => n.href));
    expect(nav.querySelector('[role="tablist"]')).toBeNull();
  });

  it('홈은 멤버 탭 활성, 멤버 화면도 멤버 탭 활성, 순위는 순위 탭', async () => {
    render(SheetTabs);
    expect(current()).toEqual(['멤버']);
    at('#/m/%EC%95%99');
    await Promise.resolve();
    expect(current()).toEqual(['멤버']);
    at('#/rank/board');
    await Promise.resolve();
    expect(current()).toEqual(['순위']);
  });

  it('roving tabindex — 활성 탭만 Tab 순서에 있다', async () => {
    at('#/records/hall');
    render(SheetTabs);
    const idx = links().map((a) => a.tabIndex);
    expect(idx).toEqual([-1, -1, 0, -1, -1, -1]);
  });

  it('화살표·Home/End 로 초점이 옮겨지고 tabindex 도 따라간다', async () => {
    render(SheetTabs);
    const as = links();
    as[0]!.focus();
    await fireEvent.keyDown(as[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(as[1]);
    expect(as[1]!.tabIndex).toBe(0);
    expect(as[0]!.tabIndex).toBe(-1);
    await fireEvent.keyDown(as[1]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(as[0]);
    await fireEvent.keyDown(as[0]!, { key: 'ArrowLeft' });   // 앞에서 감싼다
    expect(document.activeElement).toBe(as[5]);
    await fireEvent.keyDown(as[5]!, { key: 'Home' });
    expect(document.activeElement).toBe(as[0]);
    await fireEvent.keyDown(as[0]!, { key: 'End' });
    expect(document.activeElement).toBe(as[5]);
  });

  it('화면이 바뀌면 Tab 순서가 활성 탭으로 돌아온다', async () => {
    render(SheetTabs);
    const as = links();
    as[0]!.focus();
    await fireEvent.keyDown(as[0]!, { key: 'End' });
    expect(as[5]!.tabIndex).toBe(0);
    at('#/champions/meta');
    await Promise.resolve();
    expect(links().map((a) => a.tabIndex)).toEqual([-1, -1, -1, -1, 0, -1]);
  });
});
