/**
 * 툴팁 액션 — `use:tip={text}` 또는 `use:tip={{ key, payload }}`(HELP 사전).
 *
 * 떠 있는 층은 body 에 **하나**다(position: fixed — 표는 가로 스크롤이라 ::after 로 띄우면 잘린다).
 * 화면 밖으로 나가지 않게 좌우를 자르고, 아래가 좁으면 위로 띄운다.
 *
 * 여는 조건 — 옛 파일의 동작을 옮겼다:
 *  · hover 가 있는 기기: mouseenter/leave. 손가락 기기에서 mouseover 를 그대로 두면 탭 한 번에
 *    열렸다가 뒤따르는 click 이 닫아 아무것도 안 뜬 것처럼 보인다(실측).
 *  · 초점(focusin/out)은 항상 — 마우스가 없으면 설명을 아예 못 보던 문제.
 *  · 손가락 기기는 탭 토글. 물음표(`toggle: true`)는 click 을 **캡처에서 끊는다** — 정렬 가능한 th
 *    안에 있어서, 안 끊으면 설명을 보려는 탭이 표 정렬까지 바꾼다.
 *
 * 보조기술: 요소마다 `aria-describedby` 로 **자기 문구**에 연결한다. 층 하나에 describedby 를 걸면
 * 초점이 없는 요소가 다른 요소의 문구로 설명된다 — 그래서 문구는 sr-only 컨테이너 안에 요소별
 * <span> 으로 두고, 층 자체는 aria-hidden(중복 낭독 방지)이다.
 */
import type { Action } from 'svelte/action';
import { helpText, type HelpPayload } from './help';
import './tip.css';

export type TipSpec =
  | string
  | { key: string; payload?: HelpPayload | null; toggle?: boolean }
  | { text: string; toggle?: boolean };

/** 스펙 → 문구. 빈 문구는 "안 띄움"(helpText 가 모르는 키를 '' 로 돌려주는 것과 같은 약속). */
export function tipText(spec: TipSpec | null | undefined): string {
  if (spec == null) return '';
  if (typeof spec === 'string') return spec;
  if ('text' in spec) return spec.text;
  return helpText(spec.key, spec.payload);
}

const MARGIN = 8;   // 화면 가장자리·앵커와의 간격(px)

let box: HTMLDivElement | null = null;    // 떠 있는 층
let descs: HTMLDivElement | null = null;  // aria-describedby 대상 문구들(sr-only)
let current: HTMLElement | null = null;   // 지금 층이 붙어 있는 앵커
let byFocus = false;                      // 지금 열린 것이 focusin 으로 열렸는가
let seq = 0;

const hasHover = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches;

function layer(): HTMLDivElement {
  if (box) return box;
  box = document.createElement('div');
  box.id = 'tipbox';
  box.className = 'tipbox';
  box.setAttribute('role', 'tooltip');
  box.setAttribute('aria-hidden', 'true');
  box.hidden = true;
  document.body.append(box);
  // 스크롤·크기 변경이면 앵커 위치가 틀어지므로 닫는다. 표 안 스크롤도 잡게 캡처로.
  addEventListener('scroll', hide, true);
  addEventListener('resize', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  // 앵커 밖을 누르면 닫는다(손가락 기기의 유일한 닫기 수단). 앵커 안은 각자의 click 이 토글한다.
  document.addEventListener('click', (e) => {
    if (current && e.target instanceof Node && current.contains(e.target)) return;
    hide();
  }, true);
  return box;
}

function descBox(): HTMLDivElement {
  if (descs) return descs;
  descs = document.createElement('div');
  descs.id = 'tipdesc';
  descs.className = 'sr-only';
  document.body.append(descs);
  return descs;
}

function place(node: HTMLElement, b: HTMLDivElement): void {
  const r = node.getBoundingClientRect();
  const s = b.getBoundingClientRect();
  let left = r.left + r.width / 2 - s.width / 2;
  left = Math.max(MARGIN, Math.min(left, innerWidth - s.width - MARGIN));
  let top = r.bottom + MARGIN;
  if (top + s.height > innerHeight - MARGIN) top = r.top - s.height - MARGIN;   // 아래가 좁으면 위로
  b.style.left = `${Math.round(left)}px`;
  b.style.top = `${Math.round(Math.max(MARGIN, top))}px`;
}

function show(node: HTMLElement, text: string, focus = false): void {
  if (!text) { hide(); return; }
  const b = layer();
  b.textContent = text;
  b.hidden = false;
  current = node;
  byFocus = focus;
  place(node, b);
}

function hide(): void {
  if (box) box.hidden = true;
  current = null;
  byFocus = false;
}

/** 지금 층이 이 요소에 열려 있는가 — 토글·테스트용. */
export function tipOpenFor(node: HTMLElement): boolean {
  return current === node && !!box && !box.hidden;
}

export const tip: Action<HTMLElement, TipSpec> = (node, spec) => {
  let text = tipText(spec);
  let toggle = typeof spec === 'object' && !!spec.toggle;
  const id = `tip-d${++seq}`;
  const d = document.createElement('span');
  d.id = id;
  descBox().append(d);

  const apply = (): void => {
    d.textContent = text;
    if (text) node.setAttribute('aria-describedby', id);
    else node.removeAttribute('aria-describedby');
    if (current === node) show(node, text);
  };
  const enter = (): void => { if (hasHover()) show(node, text); };
  const leave = (): void => { if (current === node) hide(); };
  const focusIn = (): void => show(node, text, true);
  const focusOut = (): void => { if (current === node) hide(); };
  const click = (e: MouseEvent): void => {
    if (toggle) { e.preventDefault(); e.stopPropagation(); }
    else if (hasHover()) return;                 // 마우스 기기는 hover 가 이미 띄웠다 — 클릭은 원래 동작대로
    // 탭이 초점을 주는 기기(안드로이드·키보드 Enter)에서는 focusin 이 방금 열었다 — 그 뒤의 click 이
    // 토글로 닫아 버리면 아무것도 안 뜬 것처럼 보인다(실측). 초점으로 연 것은 첫 click 이 유지한다.
    if (hasHover() || !tipOpenFor(node) || byFocus) show(node, text);
    else hide();
  };

  apply();
  node.addEventListener('mouseenter', enter);
  node.addEventListener('mouseleave', leave);
  node.addEventListener('focusin', focusIn);
  node.addEventListener('focusout', focusOut);
  node.addEventListener('click', click);

  return {
    update(next: TipSpec) {
      text = tipText(next);
      toggle = typeof next === 'object' && !!next.toggle;
      apply();
    },
    destroy() {
      node.removeEventListener('mouseenter', enter);
      node.removeEventListener('mouseleave', leave);
      node.removeEventListener('focusin', focusIn);
      node.removeEventListener('focusout', focusOut);
      node.removeEventListener('click', click);
      if (current === node) hide();
      node.removeAttribute('aria-describedby');
      d.remove();
    },
  };
};
