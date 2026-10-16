import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Panel from '../src/components/Panel.svelte';
import StatTile from '../src/components/StatTile.svelte';
import SummaryStrip from '../src/components/SummaryStrip.svelte';
import Glyph from '../src/components/Glyph.svelte';
import MvpTag from '../src/components/MvpTag.svelte';
import ChampImg from '../src/components/ChampImg.svelte';
import { GLYPHS } from '../src/lib/glyphs';
import { ICONS } from '../src/lib/icons';
import { media } from '../src/lib/media.svelte';

afterEach(() => { cleanup(); media.phone = false; });

const body = createRawSnippet(() => ({ render: () => '<p class="body">내용</p>' }));
const act = createRawSnippet(() => ({ render: () => '<button type="button" class="go">비교</button>' }));

describe('Panel', () => {
  it('section 이름 = 제목(h2 기본) · 몸통에 children · 도형·동작 없으면 그 자리도 없다', () => {
    const { container, getByRole } = render(Panel, { title: '멤버 · 판수 순', children: body });
    const sec = getByRole('region', { name: '멤버 · 판수 순' });
    expect(sec.tagName).toBe('SECTION');
    expect(sec.querySelector('h2')?.textContent).toBe('멤버 · 판수 순');
    expect(sec.querySelector('.pb .body')?.textContent).toBe('내용');
    expect(container.querySelector('.ic')).toBeNull();
    expect(container.querySelector('.pa')).toBeNull();
  });
  it('level 3 → h3 · 도형 칩(장식) · 머리 오른쪽 동작 슬롯', () => {
    const { container } = render(Panel, { title: '라인별 성적', level: 3, glyph: 'duo', actions: act, children: body });
    expect(container.querySelector('h3')?.textContent).toBe('라인별 성적');
    expect(container.querySelector('h2')).toBeNull();
    expect(container.querySelector('.ic svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.pa button.go')?.textContent).toBe('비교');
  });
  it('제목 id 는 인스턴스마다 다르다(한 화면에 카드가 여럿)', () => {
    const a = render(Panel, { title: 'A', children: body }).container.querySelector('section')!;
    const b = render(Panel, { title: 'B', children: body }).container.querySelector('section')!;
    expect(a.getAttribute('aria-labelledby')).not.toBe(b.getAttribute('aria-labelledby'));
  });
});

describe('StatTile · SummaryStrip', () => {
  const items = [
    { label: '경기', value: '111', unit: '판' },
    { label: '멤버', value: '37', unit: '명' },
    { label: '평균 경기 시간', value: '27:47', short: '평균 27:47' },
    { label: '최근 갱신', value: '10/1 16:27', short: '갱신 10/1 16:27', datetime: '2026-10-01T16:27:00+09:00', title: '2026. 10. 1. 오후 4:27:00' },
  ];
  it('StatTile: dt 라벨 + dd 값·단위 · 시각이면 <time datetime title>', () => {
    const one = render(StatTile, { label: '경기', value: '111', unit: '판' }).container;
    expect(one.querySelector('dt')?.textContent).toBe('경기');
    expect(one.querySelector('dd')?.textContent).toBe('111판');
    expect(one.querySelector('.u')?.textContent).toBe('판');
    const t = render(StatTile, { label: '최근 갱신', value: '10/1 16:27', datetime: '2026-10-01T16:27:00+09:00', title: '전체' }).container;
    expect(t.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-01T16:27:00+09:00');
    expect(t.querySelector('time')?.getAttribute('title')).toBe('전체');
    expect(render(StatTile, { label: 'KDA', value: '3.6', compact: true }).container.querySelector('.stat.compact')).not.toBeNull();
  });
  it('데스크톱: <dl> 안 타일 네 칸(--n) · 라벨·값 순서 그대로', () => {
    const { container } = render(SummaryStrip, { items });
    const dl = container.querySelector('dl.strip') as HTMLElement;
    expect(dl.style.getPropertyValue('--n')).toBe('4');
    expect([...dl.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['경기', '멤버', '평균 경기 시간', '최근 갱신']);
    expect([...dl.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['111판', '37명', '27:47', '10/1 16:27']);
    expect(container.querySelector('p.line')).toBeNull();
  });
  it('폰: 한 줄 글로 접힌다 — 짧은 글(short) 우선, 없으면 값+단위에 라벨은 보조기술에만 · 시각은 <time>', () => {
    media.phone = true;
    const { container } = render(SummaryStrip, { items });
    const line = container.querySelector('p.line')!;
    expect(container.querySelector('dl')).toBeNull();
    const its = [...line.querySelectorAll('.it')];
    expect(its.map((s) => s.textContent)).toEqual(['경기 111판', '멤버 37명', '평균 27:47', '갱신 10/1 16:27']);
    expect(its[0]!.querySelector('.sr-only')?.textContent).toBe('경기 ');
    expect(its[2]!.querySelector('.sr-only')).toBeNull();
    expect(line.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-01T16:27:00+09:00');
    expect([...line.querySelectorAll('.sep')].map((s) => [s.textContent, s.getAttribute('aria-hidden')])).toEqual([[' · ', 'true'], [' · ', 'true'], [' · ', 'true']]);
  });
});

describe('Glyph', () => {
  it('사전의 경로를 선으로 · 기본은 장식, label 을 주면 role=img', () => {
    const deco = render(Glyph, { name: 'streak' }).container.querySelector('svg')!;
    expect(deco.getAttribute('aria-hidden')).toBe('true');
    expect(deco.querySelectorAll('path')).toHaveLength(GLYPHS.streak.length);
    const named = render(Glyph, { name: 'mvp', label: 'MVP' }).container.querySelector('svg')!;
    expect(named.getAttribute('role')).toBe('img');
    expect(named.getAttribute('aria-label')).toBe('MVP');
  });
  it('도형 사전은 아이콘 사전(ICONS)과 이름이 겹치지 않는다(둘은 다른 출처)', () => {
    const icons = new Set(Object.keys(ICONS));
    expect(Object.keys(GLYPHS).filter((k) => icons.has(k))).toEqual([]);
  });
});

describe('MvpTag · ChampImg 판수 배지', () => {
  it('MvpTag: 글자 MVP · count 를 주면 MVP n회', () => {
    expect(render(MvpTag, {}).container.querySelector('.mvp')?.textContent).toBe('MVP');
    expect(render(MvpTag, { count: 3 }).container.querySelector('.mvp')?.textContent).toBe('MVP 3회');
  });
  it('ChampImg: 40px 이상 + count 면 모서리 숫자 배지(보조기술은 n판) · 작은 초상·count 없음은 img 하나', () => {
    const big = render(ChampImg, { name: 'Ahri', patch: '15.18.1', size: 44, count: 12 }).container;
    expect(big.querySelector('.pw img.champ')?.getAttribute('width')).toBe('44');
    expect(big.querySelector('.cnt')?.textContent).toBe('12판');
    expect(big.querySelector('.cnt .sr-only')?.textContent).toBe('판');
    const small = render(ChampImg, { name: 'Ahri', patch: '15.18.1', size: 20, count: 12 }).container;
    expect(small.querySelector('.cnt')).toBeNull();
    expect(small.querySelector('.pw')).toBeNull();
    expect(small.querySelector('img.champ')).not.toBeNull();
    const none = render(ChampImg, { name: 'Ahri', patch: '15.18.1', size: 44 }).container;
    expect(none.querySelector('.cnt')).toBeNull();
    expect(none.querySelector('img.champ.big')).not.toBeNull();
    expect(render(ChampImg, { name: '../x', patch: '15.18.1', size: 44, count: 3 }).container.querySelector('.cnt')).toBeNull();
  });
});
