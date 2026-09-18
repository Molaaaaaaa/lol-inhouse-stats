import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import { ICONS, ICON_VIEWBOX, isIconName } from '../src/lib/icons';
import Icon from '../src/components/Icon.svelte';

// 옛 단일 파일이 기준이다 — 사전은 스크립트로 뽑았지만, 뽑는 쪽 정규식이 틀리면 조용히 아이콘이 빈다.
// jsdom 환경에서는 URL 이 브라우저 것이라 fs 에 못 넘긴다 — 경로 문자열로 연다
const legacy = readFileSync(join(import.meta.dirname, '../legacy/index.html'), 'utf8');

/** 옛 파일에서 아이콘을 부르던 세 가지 방식 전부 */
function usedNames(html: string): Set<string> {
  const out = new Set<string>();
  for (const re of [/\bico\('([a-z0-9-]+)'/g, /href="#i-([a-z0-9-]+)"/g, /data-ico="([a-z0-9-]+)"/g]) {
    for (const m of html.matchAll(re)) out.add(m[1]!);
  }
  return out;
}

/** 옛 스프라이트의 심볼 — 이름·viewBox·안쪽 마크업 */
function legacySymbols(html: string): Map<string, { viewBox: string; body: string }> {
  const out = new Map<string, { viewBox: string; body: string }>();
  for (const m of html.matchAll(/<symbol id="i-([a-z0-9-]+)" viewBox="([^"]+)">([\s\S]*?)<\/symbol>/g)) {
    out.set(m[1]!, { viewBox: m[2]!, body: m[3]! });
  }
  return out;
}

describe('icons 사전', () => {
  const used = usedNames(legacy);
  const symbols = legacySymbols(legacy);

  it('옛 파일이 부르던 이름은 전부 사전에 있다', () => {
    expect(used.size).toBeGreaterThan(40);   // 정규식이 헛돌아 0개면 아래 단언이 공허해진다
    const missing = [...used].filter((n) => !isIconName(n));
    expect(missing).toEqual([]);
  });

  it('옛 스프라이트와 심볼 수·마크업이 글자 단위로 같다 (손실 없음)', () => {
    expect(symbols.size).toBe(Object.keys(ICONS).length);
    for (const [name, sym] of symbols) {
      expect(isIconName(name), name).toBe(true);
      expect(ICONS[name as keyof typeof ICONS], name).toBe(sym.body);
      expect(sym.viewBox, name).toBe(ICON_VIEWBOX);
    }
  });

  it('본문은 도형 태그뿐이다 — {@html} 로 꽂히므로', () => {
    const allowed = new Set(['path', 'circle', 'line', 'polyline', 'polygon', 'rect']);
    for (const [name, body] of Object.entries(ICONS)) {
      const tags = [...body.matchAll(/<([a-z]+)/g)].map((m) => m[1]!);
      expect(tags.length, name).toBeGreaterThan(0);
      expect(tags.filter((t) => !allowed.has(t)), name).toEqual([]);
      expect(body, name).not.toMatch(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u);   // 이모지 금지
    }
  });

  it('isIconName 은 모르는 이름과 프로토타입 키를 거른다', () => {
    expect(isIconName('trophy')).toBe(true);
    expect(isIconName('emoji')).toBe(false);
    expect(isIconName('toString')).toBe(false);
  });
});

describe('Icon 컴포넌트', () => {
  it('mount 되고 장식(aria-hidden)이다', () => {
    const { container } = render(Icon, { name: 'trophy' });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
    expect(svg!.hasAttribute('role')).toBe(false);
    expect(svg!.getAttribute('viewBox')).toBe(ICON_VIEWBOX);
    expect(svg!.classList.contains('ic')).toBe(true);
    expect(svg!.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('안쪽 도형이 SVG 이름공간으로 들어간다 — HTML 요소로 들어가면 안 그려진다', () => {
    const { container } = render(Icon, { name: 'circle-dot' });
    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    expect(circle!.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('class 는 ic 뒤에 덧붙고, 없으면 ic 뿐이다 (스코프 해시는 제외)', () => {
    // 스코프 스타일 해시(svelte-xxxx)는 빌드마다 붙으므로 토큰만 본다
    const tokens = (el: Element) => [...el.classList].filter((c) => !c.startsWith('svelte-'));
    const a = render(Icon, { name: 'medal', class: 'medal m1' });
    expect(tokens(a.container.querySelector('svg')!)).toEqual(['ic', 'medal', 'm1']);
    const b = render(Icon, { name: 'medal' });
    expect(tokens(b.container.querySelector('svg')!)).toEqual(['ic']);
  });

  it('label 을 주면 읽히는 이미지가 된다 (옛 순위 메달)', () => {
    const { container } = render(Icon, { name: 'medal', label: '1위' });
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('1위');
    expect(svg.hasAttribute('aria-hidden')).toBe(false);
  });
});
