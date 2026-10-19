import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/svelte';
import { mount, unmount } from 'svelte';
import App from '../src/App.svelte';
import DesignSwitch from '../src/components/DesignSwitch.svelte';
import { LazyFiles, loadGuild, loadIndex } from '../src/lib/data/loader';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** 가짜 fetch — 요청 URL 을 모은다. 색인은 배열, 나머지는 빈 객체 */
function recordFetch(): string[] {
  const urls: string[] = [];
  vi.stubGlobal('fetch', vi.fn((u: string | URL | Request) => {
    const url = String(u);
    urls.push(url);
    return Promise.resolve(new Response(url.endsWith('guilds.json') ? '[]' : '{}', { status: 200 }));
  }));
  return urls;
}

describe('디자인 전환(2안 헤더)', () => {
  it('1안은 사이트 루트 링크, 2안은 지금 화면(눌린 칩 · aria-current, 링크 아님)', () => {
    render(DesignSwitch);
    const nav = screen.getByRole('navigation', { name: '디자인' });
    expect(nav.textContent?.replace(/\s+/g, ' ').trim()).toBe('디자인 1안 2안');
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([['1안', '/']]);
    expect(links[0]!.hasAttribute('aria-current')).toBe(false);
    const cur = within(nav).getByText('2안');
    expect(cur.getAttribute('aria-current')).toBe('page');
    expect(cur.closest('a')).toBeNull();
    // 고르기 칩 한 어휘(app.css .chip — 굵은 포인터 44px 도 거기서 온다)
    for (const el of [links[0]!, cur]) expect(el.classList.contains('chip')).toBe(true);
  });

  it('main.ts 가 붙이는 자리: App 헤더(header.top)의 오른쪽 끝', async () => {
    recordFetch();
    render(App);
    const top = document.querySelector('header.top');
    expect(top).not.toBeNull();
    const sw = mount(DesignSwitch, { target: top! });
    try {
      expect(top!.lastElementChild?.matches('nav.design')).toBe(true);
      expect(top!.lastElementChild?.previousElementSibling?.classList.contains('tools')).toBe(true);
    } finally {
      unmount(sw);
    }
    await waitFor(() => expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('false'));
  });
});

describe('발행 JSON 경로(꺼진 빌드)', () => {
  it('네 갈래 모두 페이지 옆 data/ 상대 경로 — 라이엇 제출판·지금 dist 와 같다', async () => {
    const urls = recordFetch();
    await loadIndex();
    await loadGuild('g1');
    const lazy = new LazyFiles('g1');
    await lazy.matchDetail('m1');
    await lazy.deathSample();
    expect(urls).toEqual(['data/guilds.json', 'data/g1.json', 'data/g1/m/m1.json', 'data/g1/deaths.json']);
  });
});
