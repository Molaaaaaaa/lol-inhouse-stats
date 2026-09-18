import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import Subtabs from '../src/components/Subtabs.svelte';

const TABS = [
  { id: 'sum', label: '요약' },
  { id: 'vs', label: '상대별 전적' },
  { id: 'mmr', label: 'MMR 검산' },
];

afterEach(cleanup);

function setup(active = 'sum') {
  const onchange = vi.fn();
  const r = render(Subtabs, { tabs: TABS, active, onchange, prefix: 'm' });
  const tabs = r.getAllByRole('tab');
  return { ...r, onchange, tabs };
}

describe('Subtabs', () => {
  it('tablist/tab 구조 — 활성 탭만 aria-selected·tabindex 0', () => {
    const { getByRole, tabs } = setup('vs');
    expect(getByRole('tablist', { name: '하위 화면' })).toBeTruthy();
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(tabs[1]!.id).toBe('m-tab-vs');
    expect(tabs[1]!.getAttribute('aria-controls')).toBe('m-panel-vs');
  });
  it('←→ 로 초점이 옮겨 가고 끝에서 감긴다 — 선택은 바뀌지 않는다', async () => {
    const { tabs, onchange } = setup('sum');
    tabs[0]!.focus();
    await fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[1]);
    await fireEvent.keyDown(tabs[1]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[2]);
    await fireEvent.keyDown(tabs[2]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[0]);
    await fireEvent.keyDown(tabs[0]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tabs[2]);
    expect(onchange).not.toHaveBeenCalled();
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
  });
  it('Home/End 는 양 끝으로', async () => {
    const { tabs } = setup('vs');
    tabs[1]!.focus();
    await fireEvent.keyDown(tabs[1]!, { key: 'End' });
    expect(document.activeElement).toBe(tabs[2]);
    await fireEvent.keyDown(tabs[2]!, { key: 'Home' });
    expect(document.activeElement).toBe(tabs[0]);
  });
  it('클릭(Enter/Space 는 버튼이 click 으로 바꾼다)이 onchange(id) — 이미 활성인 탭은 안 부른다', async () => {
    const { tabs, onchange } = setup('sum');
    await fireEvent.click(tabs[2]!);
    expect(onchange).toHaveBeenCalledWith('mmr');
    await fireEvent.click(tabs[0]!);
    expect(onchange).toHaveBeenCalledTimes(1);
  });
  it('active 가 바뀌면 aria-selected·tabindex 가 따라간다', async () => {
    const { rerender, getAllByRole } = setup('sum');
    await rerender({ tabs: TABS, active: 'mmr', onchange: vi.fn(), prefix: 'm' });
    const tabs = getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);
  });
  it('다른 키는 건드리지 않는다', async () => {
    const { tabs } = setup('sum');
    tabs[0]!.focus();
    await fireEvent.keyDown(tabs[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tabs[0]);
  });
});
