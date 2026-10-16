<script lang="ts">
  /**
   * 피드백 화면 — `#/feedback`. 카드(Panel) 둘: 글 남기기(누구·분류·내용·비밀번호·보내기) → 남긴 글 목록(댓글처럼 쌓인다,
   * 글 하나가 안쪽 판 하나). 처리 결과는 문장 + 틴트(색만으로 가르지 않는다).
   * 내비(NAV)에는 없고 헤더·바닥글 링크로 닿는다. 글은 전부 Svelte 텍스트 보간으로 그린다(마크업으로 해석하지 않는다).
   *
   * 지우기는 글 비밀번호가 걸린 글(haspin)에만 있고, 비밀번호 칸이 **그 줄 안에서** 열린다. 완료 표시·남의 글 정리는
   * 사이트에 없다(관리자가 자기 PC 에서 한다) — 여기서는 서버가 준 done 을 글자 '완료'로 보이기만 한다.
   */
  import { tick } from 'svelte';
  import { app, displayName } from '$lib/data/store.svelte';
  import { announce } from '$lib/a11y';
  import { dateTimeKo } from '$lib/fmt';
  import {
    KINDS, MAX_BODY, PIN_LEN, countLine, deleteFeedback, listFeedback, sendFeedback,
    type FeedbackItem, type FeedbackKind,
  } from '$lib/feedback';
  import Skeleton from '$components/Skeleton.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import Panel from '$components/Panel.svelte';

  // 라우터가 sub·params 를 넘기지만(routes.ts VIEWS 의 공통 모양) 이 화면은 하위 화면이 없어 읽지 않는다
  let {}: { sub?: string; params?: Record<string, string> } = $props();
  const uid = `fb-${Math.random().toString(36).slice(2, 8)}`;
  const onlyDigits = (s: string) => s.replace(/\D/g, '').slice(0, PIN_LEN);

  // ── 입력 ──
  let who = $state('');
  let kind = $state<FeedbackKind>(KINDS[0]);
  let body = $state('');
  let pin = $state('');
  let sending = $state(false);
  let note = $state<{ ok: boolean; text: string } | null>(null);

  const names = $derived(
    Object.values(app.data?.players ?? {}).map(displayName).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  );

  async function send(e: SubmitEvent) {
    e.preventDefault();
    if (sending) return;
    if (pin !== '' && pin.length !== PIN_LEN) {
      note = { ok: false, text: `비밀번호는 숫자 ${PIN_LEN}자리입니다.` };
      return;
    }
    sending = true;
    note = { ok: true, text: '보내는 중…' };
    const r = await sendFeedback({ who, kind, body: body.trim(), pin, page: app.data?.name ?? '' });
    sending = false;
    if (r.ok) {
      note = { ok: true, text: '고맙습니다. 잘 받았습니다.' };
      body = '';
      pin = '';
      void load();
    } else {
      note = { ok: false, text: r.error };
    }
  }

  // ── 목록 ──
  type ListState = 'loading' | 'ready' | 'failed' | 'off';
  let phase = $state<ListState>('loading');
  let items = $state<FeedbackItem[]>([]);
  let seq = 0;

  /** 처음에만 스켈레톤 — 다시 읽을 때는 보던 목록을 그대로 두고 바뀐 것만 갈아 끼운다 */
  async function load() {
    const mine = ++seq;
    if (!items.length) phase = 'loading';
    const r = await listFeedback();
    if (mine !== seq) return;
    if (r.ok) { items = r.items; phase = 'ready'; }
    else { items = []; phase = r.off ? 'off' : 'failed'; }
  }
  void load();

  // ── 지우기: 한 번에 한 줄만 열린다 ──
  let delId = $state<string | null>(null);
  let delPin = $state('');
  let delBusy = $state(false);
  let delError = $state('');
  let delInput: HTMLInputElement | undefined = $state();

  async function openDel(id: string) {
    delId = id; delPin = ''; delError = '';
    await tick();
    delInput?.focus();
  }
  async function closeDel() {
    const id = delId;
    delId = null; delPin = ''; delError = '';
    await tick();
    if (id) document.getElementById(`${uid}-open-${id}`)?.focus();
  }
  async function confirmDel(e: SubmitEvent) {
    e.preventDefault();
    if (!delId || delBusy || delPin.length !== PIN_LEN) return;
    delBusy = true; delError = '';
    const r = await deleteFeedback(delId, delPin);
    delBusy = false;
    if (r.ok) {
      delId = null; delPin = '';
      announce('글을 지웠습니다.');
      await load();
    } else {
      delError = r.error;
    }
  }
</script>

{#snippet total()}<p class="total">{countLine(items)}</p>{/snippet}

<section class="fb" aria-labelledby="{uid}-h">
  <h2 id="{uid}-h" class="sr-only">피드백</h2>

  <Panel title="글 남기기" level={3}>
    <form class="form" onsubmit={send}>
      <div class="pair">
        <label class="f">
          <span class="lb">누구</span>
          <select bind:value={who}>
            <option value="">익명으로</option>
            {#each names as n (n)}<option value={n}>{n}</option>{/each}
          </select>
        </label>
        <label class="f">
          <span class="lb">분류</span>
          <select bind:value={kind}>
            {#each KINDS as k (k)}<option value={k}>{k}</option>{/each}
          </select>
        </label>
      </div>
      <label class="f">
        <span class="lb">내용 <span class="count" aria-hidden="true">{body.length} / {MAX_BODY}</span></span>
        <textarea bind:value={body} maxlength={MAX_BODY} rows="5"></textarea>
      </label>
      <label class="f pinf">
        <span class="lb">비밀번호 (선택)</span>
        <input
          type="text" inputmode="numeric" pattern="[0-9]*" maxlength={PIN_LEN} autocomplete="off"
          placeholder="숫자 {PIN_LEN}자리" value={pin}
          oninput={(e) => { pin = onlyDigits(e.currentTarget.value); e.currentTarget.value = pin; }}
        />
      </label>
      <p class="hint">비밀번호를 적어 두면 내가 쓴 글을 나중에 지울 수 있습니다. 안 적으면 관리자만 지웁니다.</p>
      <div class="foot">
        <button type="submit" class="go" disabled={sending}>보내기</button>
        {#if note}
          <p class="note" class:bad={!note.ok} class:good={note.ok && !sending} role="status">{note.text}</p>
        {/if}
      </div>
    </form>
  </Panel>

  <Panel title="남긴 글" level={3} actions={phase === 'ready' && items.length ? total : undefined}>
    {#if phase === 'loading'}
      <Skeleton rows={4} />
    {:else if phase === 'off'}
      <EmptyState text="접수 창구가 아직 연결되지 않았습니다." />
    {:else if phase === 'failed'}
      <EmptyState text="목록을 불러오지 못했습니다." />
    {:else if !items.length}
      <EmptyState text="아직 남긴 글이 없습니다." />
    {:else}
      <ul class="list">
        {#each items as it (it.id)}
          <li class="item tile" class:done={it.done}>
            <div class="meta">
              <span class="who">{it.who || '익명'}</span>
              <span class="kind">{it.kind || '기타'}</span>
              <time datetime={it.at}>{dateTimeKo(it.at)}</time>
              {#if it.done}<span class="tag">완료</span>{/if}
              {#if it.haspin && delId !== it.id}
                <button type="button" id="{uid}-open-{it.id}" class="act" onclick={() => openDel(it.id)}>지우기</button>
              {/if}
            </div>
            <p class="tx">{it.body}</p>
            {#if delId === it.id}
              <form class="del" onsubmit={confirmDel}>
                <label class="dl">
                  <span>글 비밀번호 {PIN_LEN}자리</span>
                  <input
                    bind:this={delInput}
                    type="text" inputmode="numeric" pattern="[0-9]*" maxlength={PIN_LEN} autocomplete="off"
                    value={delPin}
                    oninput={(e) => { delPin = onlyDigits(e.currentTarget.value); e.currentTarget.value = delPin; }}
                  />
                </label>
                <button type="submit" class="act" disabled={delBusy || delPin.length !== PIN_LEN}>확인</button>
                <button type="button" class="act" onclick={closeDel} disabled={delBusy}>취소</button>
                {#if delError}<p class="err" role="alert">{delError}</p>{/if}
              </form>
            {/if}
            {#if it.reply}
              <div class="reply">
                <div class="rmeta">
                  <span class="rname">관리자 답변</span>
                  {#if it.reply.at}<time datetime={it.reply.at}>{dateTimeKo(it.reply.at)}</time>{/if}
                </div>
                <p class="rtx">{it.reply.body}</p>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Panel>
</section>

<style>
  .fb { display: flex; flex-direction: column; gap: var(--sp-4); max-width: 46rem; }

  /* 입력 — 라벨(13px/700 dim) 위, 컨트롤은 우물(--ink) 바탕 · 1px 컨트롤 테두리 · 반경 8px */
  .form { display: grid; gap: var(--sp-3); }
  .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-3); }
  .f { display: grid; gap: 6px; min-width: 0; }
  .pinf { max-width: 16rem; }
  .lb {
    display: flex; justify-content: space-between; gap: var(--sp-2);
    color: var(--dim);
    font-size: var(--fs-sm);
    font-weight: 700;
  }
  .count { font-weight: 400; color: var(--dim2); font-variant-numeric: tabular-nums; }
  select, textarea, input {
    display: block; width: 100%;
    min-height: 44px;
    padding: var(--sp-2) var(--sp-3);
    background: var(--ink);
    color: var(--txt);
    border: 1px solid var(--ctl-edge);
    border-radius: var(--r-chip);
    font-family: var(--font);
    font-size: var(--fs-md);
    transition: background-color var(--dur-1) ease-out, border-color var(--dur-1) ease-out;
  }
  textarea { resize: vertical; min-height: 8rem; line-height: var(--lh); }
  select:hover, textarea:hover, input:hover { border-color: var(--dim2); }
  select:focus-visible, textarea:focus-visible, input:focus-visible { outline-offset: 0; }
  .hint { color: var(--dim); font-size: var(--fs-sm); text-wrap: pretty; }
  .foot { display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-2) var(--sp-3); }

  /* 컨트롤 — 헤더의 .ctl 과 같은 어휘(반경 8px · 1px --ctl-edge). 보내기는 굵게, 한 단 밝은 판 */
  .go, .act {
    min-height: 34px;
    padding: 0 var(--sp-3);
    background: var(--sheet);
    color: var(--txt);
    border: 1px solid var(--ctl-edge);
    border-radius: var(--r-chip);
    white-space: nowrap;
    transition: background-color var(--dur-1) ease-out, border-color var(--dur-1) ease-out;
  }
  .go { min-height: 44px; padding: 0 var(--sp-5); font-weight: 700; background: var(--raised); box-shadow: var(--edge-hi); }
  .act:hover:not(:disabled) { background: var(--raised); }
  .go:hover:not(:disabled) { background: var(--track); }
  .go:active:not(:disabled), .act:active:not(:disabled) { background: var(--track); }
  .go:disabled, .act:disabled { color: var(--dim2); border-color: var(--grid-strong); background: var(--sheet); cursor: default; }

  /* 처리 결과 — 문장 + 틴트(뜻은 문장이 말한다 — 색만으로 구분하지 않는다) */
  .note {
    padding: var(--sp-1) var(--sp-3);
    border: 1px solid var(--grid-strong);
    border-radius: var(--r-chip);
  }
  .note.good { background: color-mix(in srgb, var(--win) 14%, transparent); border-color: color-mix(in srgb, var(--win) 45%, transparent); }
  .note.bad { background: color-mix(in srgb, var(--danger) 14%, transparent); border-color: color-mix(in srgb, var(--danger) 45%, transparent); }

  .total { color: var(--dim); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; white-space: nowrap; }

  /* 남긴 글 — 글 하나가 안쪽 판(.tile) 하나 */
  .list { display: grid; gap: var(--sp-2); list-style: none; margin: 0; padding: 0; }
  .item { padding: var(--sp-3); }
  .meta { display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-1) var(--sp-2); font-size: var(--fs-sm); color: var(--dim); }
  .who { color: var(--txt); font-weight: 700; }
  .kind {
    padding: 0 var(--sp-2);
    border-radius: var(--r-pill);
    background: var(--raised);
    color: var(--dim);
    line-height: 1.6;
  }
  .meta .act { margin-left: auto; }
  .tag {
    padding: 0 var(--sp-2);
    border: 1px solid var(--grid-strong);
    border-radius: var(--r-pill);
    color: var(--txt);
    line-height: 1.5;
  }
  .tx { margin-top: var(--sp-2); white-space: pre-wrap; overflow-wrap: anywhere; text-wrap: pretty; }
  /* 완료의 흐림은 글 머리(.who)와 본문(.tx)에만 건다 — 같은 줄의 관리자 답변은 그대로 읽힌다 */
  .item.done .tx, .item.done .who { color: var(--dim); }

  /* 관리자 답변 — 글에 딸린 우물(--ink): 들여쓰기 + 1px 테두리 + 반경 8px */
  .reply { margin: var(--sp-3) 0 0 var(--sp-4); background: var(--ink); border: 1px solid var(--grid); border-radius: var(--r-chip); }
  .rmeta {
    display: flex; flex-wrap: wrap; gap: var(--sp-1) var(--sp-3);
    padding: var(--sp-1) var(--sp-3);
    border-bottom: 1px solid var(--grid);
    color: var(--dim);
    font-size: var(--fs-sm);
  }
  .rname { font-weight: 700; color: var(--txt); }
  .rtx { margin: 0; padding: var(--sp-2) var(--sp-3); white-space: pre-wrap; overflow-wrap: anywhere; text-wrap: pretty; }

  /* 지우기 — 그 글 안에서 열린다 */
  .del { display: flex; align-items: flex-end; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-3); }
  .dl { display: flex; flex-direction: column; gap: var(--sp-1); color: var(--dim); font-size: var(--fs-sm); }
  .dl input { width: 9ch; min-height: 34px; padding: var(--sp-1) var(--sp-2); }
  .err {
    flex-basis: 100%;
    padding: var(--sp-1) var(--sp-3);
    background: color-mix(in srgb, var(--danger) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger) 45%, transparent);
    border-radius: var(--r-chip);
  }

  @media (pointer: coarse) {
    .go, .act, .dl input { min-height: 44px; }
    select, textarea, input { font-size: 16px; }
  }
  @media (max-width: 640px) {
    .fb { gap: var(--sp-3); }
    .pair { grid-template-columns: minmax(0, 1fr); }
    .pinf { max-width: none; }
    .item { padding: var(--sp-2) 10px 10px; }
    .reply { margin-left: var(--sp-2); }
  }
  @media (prefers-reduced-motion: reduce) {
    .go, .act, select, textarea, input { transition: none; }
  }
</style>
