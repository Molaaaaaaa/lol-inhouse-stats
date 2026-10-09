import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import Feedback from '../src/routes/Feedback.svelte';
import { app } from '../src/lib/data/store.svelte';
import { parseHash } from '../src/lib/router.svelte';
import { VIEWS, VIEW_TITLE } from '../src/lib/routes';
import { NAV } from '../src/lib/nav';
import { KINDS, countLine, type FeedbackItem } from '../src/lib/feedback';
import type { GuildPayload } from '../src/lib/data/types';

const PAYLOAD = {
  name: '테스트 방',
  players: {
    p1: { name: '맹구', record: { games: 3 } },
    p2: { name: '앙앙맹', record: { games: 3 } },
    p3: { name: 'Faker', record: { games: 3 } },
  },
} as unknown as GuildPayload;

const item = (id: string, over: Partial<FeedbackItem> = {}): FeedbackItem => ({
  id, at: '2026-10-01T12:30:00.000Z', who: '익명', kind: '버그', body: `본문 ${id}`, done: false, haspin: false, reply: null, ...over,
});

interface Call { method: string; body: Record<string, unknown> | null }

/** 가짜 /api/feedback — 호출 기록과 응답을 테스트가 정한다 */
function fakeServer(opts: {
  items?: FeedbackItem[];
  listJson?: unknown;
  listStatus?: number;
  post?: { status: number; json: unknown };
  del?: (id: string, pin: string) => { status: number; json: unknown };
}) {
  const calls: Call[] = [];
  let items = opts.items ?? [];
  const reply = (status: number, json: unknown) =>
    Promise.resolve(new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } }));
  const fn = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe('/api/feedback');
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    calls.push({ method, body });
    if (method === 'POST') {
      const p = opts.post ?? { status: 200, json: { ok: true, id: 'new.json' } };
      if (p.status === 200) items = [item('new.json', { body: String(body?.body) }), ...items];
      return reply(p.status, p.json);
    }
    if (method === 'DELETE') {
      const r = opts.del!(String(body?.id), String(body?.pin));
      if (r.status === 200) items = items.filter((x) => x.id !== body?.id);
      return reply(r.status, r.json);
    }
    return reply(opts.listStatus ?? 200, opts.listJson ?? { items });
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}

const rows = () => [...document.querySelectorAll('.list > li')] as HTMLElement[];
const field = (name: RegExp) => screen.getByLabelText(name) as HTMLInputElement;
const typeInto = (el: HTMLElement, value: string) => fireEvent.input(el, { target: { value } });

describe('피드백 화면', () => {
  beforeEach(() => {
    cleanup();
    app.data = PAYLOAD;
    app.status = 'ready';
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  describe('목록', () => {
    const items = [
      item('a.json', { who: '맹구', kind: '숫자가 이상함', body: '승률이 이상합니다', haspin: true }),
      item('b.json', { done: true, body: '고친 글' }),
      item('c.json', { body: '비밀번호 없는 글' }),
    ];

    it('건수 줄·글마다 누구·분류·본문, 완료는 글자, 지우기는 haspin 에만', async () => {
      fakeServer({ items });
      render(Feedback);
      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(screen.getByText('3건 · 처리 전 2건')).toBeTruthy();
      expect(countLine(items)).toBe('3건 · 처리 전 2건');
      const [a, b, c] = rows() as [HTMLElement, HTMLElement, HTMLElement];
      expect(a.textContent).toContain('맹구');
      expect(a.textContent).toContain('숫자가 이상함');
      expect(a.textContent).toContain('승률이 이상합니다');
      expect(within(b).getByText('완료')).toBeTruthy();       // 색이 아니라 글자
      expect(b.classList.contains('done')).toBe(true);
      expect(within(a).queryByText('완료')).toBeNull();
      expect(within(a).getByRole('button', { name: '지우기' })).toBeTruthy();
      expect(within(b).queryByRole('button', { name: '지우기' })).toBeNull();
      expect(within(c).queryByRole('button', { name: '지우기' })).toBeNull();
    });

    it('로딩 동안 스켈레톤, 빈 목록은 EmptyState', async () => {
      fakeServer({ items: [] });
      const { container } = render(Feedback);
      expect(container.querySelector('.skel')).toBeTruthy();
      await screen.findByText('아직 남긴 글이 없습니다.');
      expect(container.querySelector('.skel')).toBeNull();
    });

    it('보관함 미연결(off 응답·503)은 한 문장 안내', async () => {
      fakeServer({ listJson: { items: [], off: true } });
      render(Feedback);
      await screen.findByText('접수 창구가 아직 연결되지 않았습니다.');
      cleanup();
      fakeServer({ listStatus: 503, listJson: { error: '보관함이 연결되지 않았습니다.' } });
      render(Feedback);
      await screen.findByText('접수 창구가 아직 연결되지 않았습니다.');
    });

    it('목록을 못 받으면 안내', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
      render(Feedback);
      await screen.findByText('목록을 불러오지 못했습니다.');
    });

    it('글은 HTML 로 해석되지 않고 글자로 나온다', async () => {
      const evil = '<img src=x onerror="window.__pwned=1"><b>굵게</b>';
      fakeServer({ items: [item('x.json', { body: evil, who: '<i>누구</i>' })] });
      const { container } = render(Feedback);
      await waitFor(() => expect(rows()).toHaveLength(1));
      const row = rows()[0]!;
      expect(row.querySelector('img')).toBeNull();
      expect(row.querySelector('b')).toBeNull();
      expect(row.querySelector('i')).toBeNull();
      expect(row.querySelector('.tx')!.textContent).toBe(evil);
      expect(row.querySelector('.who')!.textContent).toBe('<i>누구</i>');
      expect(container.querySelector('img')).toBeNull();
      expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
    });
  });

  describe('관리자 답변', () => {
    const REPLY_AT = '2026-10-02T09:05:00.000Z';
    const reply = (body: string) => ({ body, at: REPLY_AT });
    const replyOf = (row: HTMLElement) => row.querySelector('.reply') as HTMLElement | null;

    it('답변이 있는 글은 글 아래에 이름·시각·본문 줄이 붙고, 없는 글에는 줄이 없다', async () => {
      fakeServer({ items: [
        item('a.json', { body: '질문입니다', reply: reply('확인했습니다.\n다음 판부터 고쳐집니다.') }),
        item('b.json', { body: '답 없는 글' }),
      ] });
      render(Feedback);
      await waitFor(() => expect(rows()).toHaveLength(2));
      const [a, b] = rows() as [HTMLElement, HTMLElement];
      const r = replyOf(a)!;
      expect(r).toBeTruthy();
      expect(within(r).getByText('관리자 답변')).toBeTruthy();
      expect(r.querySelector('.rtx')!.textContent).toBe('확인했습니다.\n다음 판부터 고쳐집니다.');
      const t = r.querySelector('time')!;
      expect(t.getAttribute('datetime')).toBe(REPLY_AT);
      expect(t.textContent).not.toBe('');
      expect(a.querySelector('.tx')!.textContent).toBe('질문입니다');   // 글 본문은 그대로
      expect(replyOf(b)).toBeNull();
      expect(b.textContent).not.toContain('관리자 답변');
    });

    it('답변 본문의 HTML 은 글자로 나오고 요소가 생기지 않는다', async () => {
      const evil = '<img src=x onerror="window.__pwned2=1"><b>굵게</b>';
      fakeServer({ items: [item('x.json', { reply: reply(evil) })] });
      const { container } = render(Feedback);
      await waitFor(() => expect(rows()).toHaveLength(1));
      const r = replyOf(rows()[0]!)!;
      expect(r.querySelector('.rtx')!.textContent).toBe(evil);
      expect(r.querySelector('img')).toBeNull();
      expect(r.querySelector('b')).toBeNull();
      expect(container.querySelector('img')).toBeNull();
      expect((window as unknown as { __pwned2?: number }).__pwned2).toBeUndefined();
    });

    it('완료 글의 흐림(.who·.tx)은 답변에 닿지 않는다 — 완료 글자는 그대로 있다', async () => {
      fakeServer({ items: [item('d.json', { done: true, reply: reply('처리했습니다.') })] });
      render(Feedback);
      await waitFor(() => expect(rows()).toHaveLength(1));
      const row = rows()[0]!;
      const r = replyOf(row)!;
      expect(within(row).getByText('완료')).toBeTruthy();
      expect(row.classList.contains('done')).toBe(true);
      // 흐림은 `.item.done .tx`·`.item.done .who` 에만 걸린다 — 답변 줄은 그 어느 쪽에도 속하지 않는다
      expect(r.matches('.tx, .who')).toBe(false);
      expect(r.querySelector('.tx, .who')).toBeNull();
      expect(r.closest('.tx, .who')).toBeNull();
    });

    it.each([
      ['body 가 숫자', { body: 42, at: REPLY_AT }],
      ['body 가 null', { body: null, at: REPLY_AT }],
      ['body 가 빈 글자', { body: '', at: REPLY_AT }],
      ['reply 가 글자', 'oops'],
      ['reply 가 배열', ['x']],
    ])('모양이 이상한 reply(%s)는 답변 줄 없이 글만 나온다', async (_n, bad) => {
      fakeServer({ listJson: { items: [{ ...item('z.json', { body: '본문 z' }), reply: bad }] } });
      render(Feedback);
      await waitFor(() => expect(rows()).toHaveLength(1));
      expect(replyOf(rows()[0]!)).toBeNull();
      expect(rows()[0]!.textContent).toContain('본문 z');
    });

    it('at 이 없거나 글자가 아니면 시각 없이 이름과 본문만 나온다 · reply 키가 아예 없어도 안 깨진다', async () => {
      const { reply: _drop, ...noReplyKey } = item('n.json', { body: '키 없는 글' });
      fakeServer({ listJson: { items: [
        { ...item('m.json'), reply: { body: '시각 없는 답', at: 7 } },
        noReplyKey,
      ] } });
      render(Feedback);
      await waitFor(() => expect(rows()).toHaveLength(2));
      const r = replyOf(rows()[0]!)!;
      expect(r.querySelector('time')).toBeNull();
      expect(r.querySelector('.rtx')!.textContent).toBe('시각 없는 답');
      expect(replyOf(rows()[1]!)).toBeNull();
    });
  });

  describe('보내기', () => {
    it('멤버 이름 select 는 맨 앞이 익명으로, 분류는 4개', async () => {
      fakeServer({});
      render(Feedback);
      const who = field(/^누구/) as unknown as HTMLSelectElement;
      expect([...who.options].map((o) => o.textContent)).toEqual(['익명으로', 'Faker', '맹구', '앙앙맹']);
      const kind = field(/^분류/) as unknown as HTMLSelectElement;
      expect([...kind.options].map((o) => o.value)).toEqual([...KINDS]);
      expect(KINDS).toHaveLength(4);
      await screen.findByText('아직 남긴 글이 없습니다.');
    });

    it('성공: 본문 계약대로 POST → 감사 문구 → 입력 비움 → 목록 다시 읽음', async () => {
      const { calls } = fakeServer({});
      render(Feedback);
      await screen.findByText('아직 남긴 글이 없습니다.');
      fireEvent.change(field(/^누구/), { target: { value: '맹구' } });
      fireEvent.change(field(/^분류/), { target: { value: '이런 걸 보고 싶다' } });
      await typeInto(field(/^내용/), '  새 기능을 원합니다  ');
      await typeInto(field(/^비밀번호/), '12a345');          // 숫자만 남는다
      expect(field(/^비밀번호/).value).toBe('1234');
      await fireEvent.click(screen.getByRole('button', { name: '보내기' }));
      await screen.findByText('고맙습니다. 잘 받았습니다.');
      const post = calls.find((c) => c.method === 'POST')!;
      expect(post.body).toEqual({ who: '맹구', kind: '이런 걸 보고 싶다', body: '새 기능을 원합니다', pin: '1234', page: '테스트 방' });
      expect(field(/^내용/).value).toBe('');
      expect(field(/^비밀번호/).value).toBe('');
      await waitFor(() => expect(rows()).toHaveLength(1));
      expect(rows()[0]!.textContent).toContain('새 기능을 원합니다');
      expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2);
    });

    it.each([
      [400, '내용을 다섯 글자 이상 적어주세요.'],
      [429, '조금만 천천히요. 20초 뒤에 다시 보내주세요.'],
      [503, '아직 접수 창구가 연결되지 않았습니다.'],
    ])('실패 %i: 서버 문구를 그대로 보이고 입력은 남긴다', async (status, error) => {
      fakeServer({ post: { status, json: { error } } });
      render(Feedback);
      await screen.findByText('아직 남긴 글이 없습니다.');
      await typeInto(field(/^내용/), '지우면 안 되는 내용');
      await fireEvent.click(screen.getByRole('button', { name: '보내기' }));
      const msg = await screen.findByText(error);
      expect(msg.getAttribute('role')).toBe('status');
      expect(field(/^내용/).value).toBe('지우면 안 되는 내용');
    });

    it('네트워크 실패는 기본 문구, 비밀번호가 4자리가 아니면 보내지 않는다', async () => {
      const { calls } = fakeServer({});
      render(Feedback);
      await screen.findByText('아직 남긴 글이 없습니다.');
      await typeInto(field(/^내용/), '내용 내용 내용');
      await typeInto(field(/^비밀번호/), '12');
      await fireEvent.click(screen.getByRole('button', { name: '보내기' }));
      await screen.findByText('비밀번호는 숫자 4자리입니다.');
      expect(calls.some((c) => c.method === 'POST')).toBe(false);

      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
      await typeInto(field(/^비밀번호/), '');
      await fireEvent.click(screen.getByRole('button', { name: '보내기' }));
      await screen.findByText('전송에 실패했습니다.');
    });
  });

  describe('지우기', () => {
    const base = [
      item('a.json', { body: '지울 글', haspin: true }),
      item('b.json', { body: '남길 글', haspin: true }),
    ];
    const del = (id: string, pin: string) =>
      pin === '1234' ? { status: 200, json: { ok: true } } : { status: 403, json: { error: '비밀번호가 맞지 않습니다.' } };

    it('그 줄 안에서 입력칸이 열리고, 4자리가 되기 전엔 확인이 잠겨 있다 · 취소하면 닫힌다', async () => {
      fakeServer({ items: base, del });
      render(Feedback);
      await waitFor(() => expect(rows()).toHaveLength(2));
      const first = rows()[0]!;
      await fireEvent.click(within(first).getByRole('button', { name: '지우기' }));
      const pin = within(first).getByLabelText(/글 비밀번호 4자리/) as HTMLInputElement;
      expect(document.activeElement).toBe(pin);
      expect(within(rows()[1]!).queryByLabelText(/글 비밀번호/)).toBeNull();
      const ok = within(first).getByRole('button', { name: '확인' }) as HTMLButtonElement;
      expect(ok.disabled).toBe(true);
      await typeInto(pin, '12');
      expect(ok.disabled).toBe(true);
      await typeInto(pin, '1234');
      expect(ok.disabled).toBe(false);
      await fireEvent.click(within(first).getByRole('button', { name: '취소' }));
      expect(within(first).queryByLabelText(/글 비밀번호/)).toBeNull();
      expect(document.activeElement).toBe(within(first).getByRole('button', { name: '지우기' }));
    });

    it('틀린 번호는 서버 오류가 그 줄에 보이고 글은 남는다, 맞는 번호는 글이 사라진다', async () => {
      const { calls } = fakeServer({ items: base, del });
      render(Feedback);
      await waitFor(() => expect(rows()).toHaveLength(2));
      const first = rows()[0]!;
      await fireEvent.click(within(first).getByRole('button', { name: '지우기' }));
      await typeInto(within(first).getByLabelText(/글 비밀번호/), '0000');
      await fireEvent.click(within(first).getByRole('button', { name: '확인' }));
      const err = await within(first).findByRole('alert');
      expect(err.textContent).toBe('비밀번호가 맞지 않습니다.');
      expect(rows()).toHaveLength(2);
      expect(within(rows()[1]!).queryByRole('alert')).toBeNull();

      await typeInto(within(first).getByLabelText(/글 비밀번호/), '1234');
      await fireEvent.click(within(first).getByRole('button', { name: '확인' }));
      await waitFor(() => expect(rows()).toHaveLength(1));
      expect(rows()[0]!.textContent).toContain('남길 글');
      const dels = calls.filter((c) => c.method === 'DELETE').map((c) => c.body);
      expect(dels).toEqual([{ id: 'a.json', pin: '0000' }, { id: 'a.json', pin: '1234' }]);
    });

    it('429 잠금 문구도 그 줄에 그대로', async () => {
      fakeServer({ items: base, del: () => ({ status: 429, json: { error: '잠시 뒤에 다시 해주세요(10초).' } }) });
      render(Feedback);
      await waitFor(() => expect(rows()).toHaveLength(2));
      const first = rows()[0]!;
      await fireEvent.click(within(first).getByRole('button', { name: '지우기' }));
      await typeInto(within(first).getByLabelText(/글 비밀번호/), '9999');
      await fireEvent.click(within(first).getByRole('button', { name: '확인' }));
      expect((await within(first).findByRole('alert')).textContent).toBe('잠시 뒤에 다시 해주세요(10초).');
    });
  });
});

describe('피드백 라우트', () => {
  it('#/feedback 은 feedback 섹션이고 모르는 경로가 아니다', () => {
    expect(parseHash('#/feedback')).toMatchObject({ section: 'feedback', unknown: false });
    expect(parseHash('#/feedback/').section).toBe('feedback');
    expect(parseHash('#/feedback/x').unknown).toBe(true);
  });
  it('화면·제목은 있고 내비(최대 6)에는 없다', () => {
    expect(typeof VIEWS.feedback).toBe('function');
    expect(VIEW_TITLE.feedback).toBe('피드백');
    expect(NAV.map((n) => n.id)).not.toContain('feedback');
    expect(NAV.length).toBeLessThanOrEqual(6);
  });
});
