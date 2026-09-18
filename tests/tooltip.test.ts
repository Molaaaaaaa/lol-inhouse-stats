import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import QMark from '../src/components/Tooltip.svelte';
import CodePlate from '../src/components/CodePlate.svelte';
import { tipOpenFor, tipText } from '../src/lib/tip';
import { helpText } from '../src/lib/help';
import { metricCode } from '../src/lib/metric-code';

const box = (): HTMLElement | null => document.getElementById('tipbox');
const described = (el: Element): string =>
  document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent ?? '';

afterEach(cleanup);

describe('QMark(Tooltip.svelte) + tip 액션', () => {
  it('초점이 가면 문구가 층에 뜨고, 나가면 닫힌다', async () => {
    const { getByRole } = render(QMark, { text: '첫 줄\n둘째 줄' });
    const btn = getByRole('button', { name: '설명' });
    expect(box()?.hidden ?? true).toBe(true);
    await fireEvent.focusIn(btn);
    expect(box()!.hidden).toBe(false);
    expect(box()!.textContent).toBe('첫 줄\n둘째 줄');
    expect(tipOpenFor(btn)).toBe(true);
    await fireEvent.focusOut(btn);
    expect(box()!.hidden).toBe(true);
  });
  it('요소는 aria-describedby 로 자기 문구에 연결된다 — 층이 닫혀 있어도', () => {
    const { getByRole } = render(QMark, { text: '설명 문구입니다.' });
    const btn = getByRole('button', { name: '설명' });
    expect(described(btn)).toBe('설명 문구입니다.');
    expect(btn.getAttribute('aria-describedby')).not.toBe('tipbox');
  });
  it('HELP 사전 키로 문구를 찾는다', async () => {
    const { getByRole } = render(QMark, { key: 'MVP' });
    const btn = getByRole('button');
    expect(described(btn)).toBe(helpText('MVP'));
    await fireEvent.focusIn(btn);
    expect(box()!.textContent).toBe(helpText('MVP'));
  });
  it('모르는 키·빈 문구는 띄우지 않고 describedby 도 달지 않는다', async () => {
    const { getByRole } = render(QMark, { key: '없는키' });
    const btn = getByRole('button');
    expect(btn.hasAttribute('aria-describedby')).toBe(false);
    await fireEvent.focusIn(btn);
    expect(box()?.hidden ?? true).toBe(true);
  });
  it('손가락 기기(hover 없음)에서는 탭이 토글이고, 밖을 누르면 닫힌다', async () => {
    const { getByRole } = render(QMark, { text: '토글' });
    const btn = getByRole('button');
    await fireEvent.click(btn);
    expect(tipOpenFor(btn)).toBe(true);
    await fireEvent.click(btn);
    expect(tipOpenFor(btn)).toBe(false);
    await fireEvent.click(btn);
    expect(tipOpenFor(btn)).toBe(true);
    await fireEvent.click(document.body);
    expect(tipOpenFor(btn)).toBe(false);
  });
  it('탭이 초점을 주는 기기: focusin 이 연 것을 바로 뒤의 click 이 닫지 않는다(안드로이드 실측)', async () => {
    const { getByRole } = render(QMark, { text: '초점 뒤 클릭' });
    const btn = getByRole('button');
    await fireEvent.focusIn(btn);
    await fireEvent.click(btn);
    expect(tipOpenFor(btn)).toBe(true);
    await fireEvent.click(btn);      // 두 번째 탭은 토글
    expect(tipOpenFor(btn)).toBe(false);
    await fireEvent.click(btn);
    expect(tipOpenFor(btn)).toBe(true);
  });
  it('Escape 로 닫힌다', async () => {
    const { getByRole } = render(QMark, { text: 'esc' });
    const btn = getByRole('button');
    await fireEvent.focusIn(btn);
    expect(tipOpenFor(btn)).toBe(true);
    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(tipOpenFor(btn)).toBe(false);
  });
  it('버튼 이름은 바꿀 수 있고, 층은 보조기술에 숨긴다(중복 낭독 방지)', () => {
    const { getByRole } = render(QMark, { text: 't', label: 'CP 설명' });
    getByRole('button', { name: 'CP 설명' });
    expect(box()!.getAttribute('aria-hidden')).toBe('true');
    expect(box()!.getAttribute('role')).toBe('tooltip');
  });
  it('tipText — 문자열·{text}·{key,payload} 세 꼴', () => {
    expect(tipText('a')).toBe('a');
    expect(tipText({ text: 'b' })).toBe('b');
    expect(tipText({ key: 'MMR' })).toBe(helpText('MMR'));
    expect(tipText({ key: '기준선', payload: { baseline: null } })).toContain('솔랭 표본');
    expect(tipText(null)).toBe('');
  });
});

describe('metricCode · CodePlate — 설명에 실제로 있는 대회식 코드만', () => {
  it("'대회 지표' 뒤의 코드가 우선 — 실데이터 문형", () => {
    expect(metricCode('15분 골드 차입니다. 대회 지표의 GD10 입니다')).toBe('GD10');
    expect(metricCode('1분당 CS(미니언+정글 몬스터). 대회 지표는 CSM 입니다. 총 CS 는 경기가 길수록 커지므로 분당으로 봅니다.')).toBe('CSM');
    expect(metricCode('10분 시점 맞라인 상대와의 CS 차이. 대회 지표는 CSD10 입니다.')).toBe('CSD10');
  });
  it('문형이 없으면 첫 매치 — 맨몸 두 글자(CS·XP)는 단위어라 제외', () => {
    expect(metricCode('XPD15 와 GD15 를 함께 봅니다')).toBe('XPD15');
    expect(metricCode('10분 시점 CS.')).toBe('');
    expect(metricCode('XP 차이와 KDA 를 봅니다')).toBe('KDA');
  });
  it('없으면 빈 문자열 — 코드를 지어내지 않는다', () => {
    expect(metricCode('설명')).toBe('');
    expect(metricCode('')).toBe('');
    expect(metricCode(null)).toBe('');
    expect(metricCode('a 한 글자·소문자 abc·너무 긴 ABCDEFG 는 코드가 아니다')).toBe('');
  });
  it('CodePlate 는 빈 코드면 아무것도 그리지 않는다', () => {
    expect(render(CodePlate, { code: '' }).container.querySelector('span')).toBeNull();
    const el = render(CodePlate, { code: 'GD10' }).container.querySelector('span')!;
    expect(el.textContent).toBe('GD10');
    expect(el.classList.contains('code')).toBe(true);
  });
});
