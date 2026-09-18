import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import SearchCell from '../src/components/SearchCell.svelte';
import { app } from '../src/lib/data/store.svelte';
import { memberHref, router } from '../src/lib/router.svelte';
import type { GuildPayload, PlayerPub } from '../src/lib/data/types';

// 작은 픽스처 — 검색 셀은 players 의 표시명·판수만 본다
function player(name: string, games: number, tag?: string): PlayerPub {
  return { name, ...(tag ? { tag } : {}), record: { games } } as unknown as PlayerPub;
}
const PAYLOAD = {
  players: { p1: player('앙앙맹', 6), p2: player('맹구', 12), p3: player('앙리', 3), p4: player('Faker', 9), p5: player('앙리', 2, '2') },
} as unknown as GuildPayload;

const box = () => screen.getByRole('combobox', { name: '소환사명 검색' }) as HTMLInputElement;
const optionNames = () => screen.getAllByRole('option').map((o) => (o.querySelector('.name') ?? o).textContent?.trim());

describe('SearchCell', () => {
  beforeEach(() => {
    cleanup();
    location.hash = '';
    app.data = PAYLOAD;
    app.status = 'ready';
    router.start();
  });

  it('초성 질의 ㅇㅇㅁ → 앙앙맹 후보, 판수 병기, aria-expanded', async () => {
    render(SearchCell);
    const inp = box();
    expect(inp.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.focus(inp);
    await fireEvent.input(inp, { target: { value: 'ㅇㅇㅁ' } });
    expect(inp.getAttribute('aria-expanded')).toBe('true');
    expect(optionNames()).toEqual(['앙앙맹']);
    expect(screen.getByRole('option').textContent).toContain('6판');
    expect(screen.getByRole('listbox', { name: '검색 결과' })).toBeTruthy();
  });

  it('동명이인은 표시명(이름~순번)으로 갈라진다', async () => {
    render(SearchCell);
    const inp = box();
    await fireEvent.input(inp, { target: { value: '앙리' } });
    expect(optionNames()).toEqual(['앙리', '앙리~2']);
  });

  it('↓ 로 가리키고 Enter → location.hash 가 memberHref, 입력은 비고 목록은 닫힌다', async () => {
    render(SearchCell);
    const inp = box();
    await fireEvent.input(inp, { target: { value: '앙' } });
    expect(optionNames()).toEqual(['앙리', '앙리~2', '앙앙맹']);
    expect(inp.getAttribute('aria-activedescendant')).toBeNull();
    await fireEvent.keyDown(inp, { key: 'ArrowDown' });
    const first = screen.getAllByRole('option')[0]!;
    expect(inp.getAttribute('aria-activedescendant')).toBe(first.id);
    expect(first.getAttribute('aria-selected')).toBe('true');
    await fireEvent.keyDown(inp, { key: 'ArrowDown' });
    await fireEvent.keyDown(inp, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[2]!.getAttribute('aria-selected')).toBe('true');
    await fireEvent.keyDown(inp, { key: 'Enter' });
    expect(location.hash).toBe(memberHref('앙앙맹'));
    expect(inp.value).toBe('');
    expect(inp.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('가리킨 것이 없을 때 Enter 는 첫 후보', async () => {
    render(SearchCell);
    const inp = box();
    await fireEvent.input(inp, { target: { value: 'fak' } });
    await fireEvent.keyDown(inp, { key: 'Enter' });
    expect(location.hash).toBe(memberHref('Faker'));
  });

  it('↑ 는 끝으로 감싼다', async () => {
    render(SearchCell);
    const inp = box();
    await fireEvent.input(inp, { target: { value: '앙' } });
    await fireEvent.keyDown(inp, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[2]!.getAttribute('aria-selected')).toBe('true');
  });

  it('마우스로 고르면 이동한다', async () => {
    render(SearchCell);
    const inp = box();
    await fireEvent.input(inp, { target: { value: '맹구' } });
    const opt = screen.getByRole('option');
    await fireEvent.mouseDown(opt);
    await fireEvent.mouseUp(opt);
    expect(location.hash).toBe(memberHref('맹구'));
  });

  it('Esc 는 목록을 닫고, 다시 Esc 는 입력을 비운다', async () => {
    render(SearchCell);
    const inp = box();
    await fireEvent.input(inp, { target: { value: '앙' } });
    expect(inp.getAttribute('aria-expanded')).toBe('true');
    await fireEvent.keyDown(inp, { key: 'Escape' });
    expect(inp.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(inp.value).toBe('앙');
    await fireEvent.keyDown(inp, { key: 'Escape' });
    expect(inp.value).toBe('');
    expect(location.hash).toBe('');
  });

  it('맞는 이름이 없으면 "검색 결과가 없습니다" 한 줄, Enter 는 아무 데도 안 간다', async () => {
    render(SearchCell);
    const inp = box();
    await fireEvent.input(inp, { target: { value: 'zzz' } });
    const none = screen.getByRole('option');
    expect(none.textContent).toBe('검색 결과가 없습니다');
    expect(none.getAttribute('aria-disabled')).toBe('true');
    await fireEvent.keyDown(inp, { key: 'Enter' });
    expect(location.hash).toBe('');
  });

  it('빈 질의는 목록을 열지 않는다 · placeholder 는 예시 이름이 아니다', async () => {
    render(SearchCell);
    const inp = box();
    await fireEvent.focus(inp);
    expect(inp.getAttribute('aria-expanded')).toBe('false');
    expect(inp.placeholder).toBe('소환사명');
  });

  it('데이터가 없어도 죽지 않는다', async () => {
    app.data = null;
    render(SearchCell);
    const inp = box();
    await fireEvent.input(inp, { target: { value: '앙' } });
    expect(screen.getByRole('option').textContent).toBe('검색 결과가 없습니다');
  });
});
