/**
 * 데이터 로딩 — 색인 → 길드 페이로드 → (볼 때) 데스 표본·경기 상세.
 *
 * 규칙(옛 파일에서 실측으로 정한 것):
 * · `cache:'no-cache'` 로 받는다. `?t=Date.now()` 를 붙이면 URL 이 매번 달라져 조건부 요청이
 *   아예 안 나가고, 바뀐 게 없어도 전량을 다시 받는다(143KB vs 304 면 300B).
 * · **실패는 캐시하지 않는다.** null 을 넣어 두면 두 번째 시도부터 fetch 없이 같은 실패를
 *   돌려주고 "다시 눌러 주세요" 가 거짓말이 된다.
 * · 길드가 바뀌면 상세·데스 캐시를 비운다.
 * · 파일명 조각은 `safeId` 를 지나야 한다.
 */
import { sanitize, safeId } from './sanitize';
import type { DeathsFile, GuildIndexEntry, GuildPayload, MatchDetail } from './types';

export const LOAD_FAIL = '전적 데이터를 받지 못했습니다. 연결을 확인하고 다시 시도해 주세요.';
export const NO_DATA = '아직 데이터가 없습니다. 첫 내전이 기록되면 표시됩니다.';

export class LoadError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'LoadError';
  }
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: 'no-cache', ...init });
  if (!r.ok) throw new LoadError(`HTTP ${r.status}`, r.status);
  return sanitize((await r.json()) as T);
}

export async function loadIndex(): Promise<GuildIndexEntry[]> {
  const idx = await getJson<GuildIndexEntry[]>('data/guilds.json');
  return (Array.isArray(idx) ? idx : []).filter((g) => safeId(g.id));
}

export async function loadGuild(gid: string): Promise<GuildPayload> {
  if (!safeId(gid)) throw new LoadError('잘못된 데이터 식별자입니다.');
  return getJson<GuildPayload>(`data/${encodeURIComponent(gid)}.json`);
}

/** 길드 하나의 지연 파일 캐시. 길드가 바뀌면 새로 만든다. */
export class LazyFiles {
  private details = new Map<string, MatchDetail>();
  private deaths: DeathsFile | null = null;
  constructor(readonly gid: string) {}

  /** 경기 상세 — 실패하면 null 을 **돌려주되 캐시하지 않는다.** */
  async matchDetail(slug: string): Promise<MatchDetail | null> {
    if (!safeId(slug)) return null;
    const hit = this.details.get(slug);
    if (hit) return hit;
    try {
      // 파일명은 익명 슬러그이고 내용이 안 바뀌므로 기본 캐시 정책을 쓴다
      const d = await getJson<MatchDetail>(
        `data/${encodeURIComponent(this.gid)}/m/${encodeURIComponent(slug)}.json`, { cache: 'default' });
      this.details.set(slug, d);
      return d;
    } catch {
      return null;
    }
  }

  /** 데스 좌표 표본 — 히트맵이 눈에 들어올 때만 받는다. 실패는 던진다(호출부가 재시도 UI). */
  async deathSample(signal?: AbortSignal): Promise<DeathsFile> {
    if (this.deaths) return this.deaths;
    const d = await getJson<DeathsFile>(`data/${encodeURIComponent(this.gid)}/deaths.json`, { signal });
    this.deaths = d;
    return d;
  }
}

/**
 * 새 버전 감지 — 배포 뒤에 열려 있던 탭은 새로고침 전까지 옛 화면이다(실측 제보 2건).
 * ETag 를 기억해 두고 탭이 다시 보일 때 + 10분마다 HEAD 로 대조한다.
 * **자동 새로고침은 하지 않는다** — 보던 화면과 펼친 패널이 통째로 날아간다. 알리기만 한다.
 */
export function watchFreshness(onStale: () => void, intervalMs = 10 * 60 * 1000): () => void {
  let seen: string | null = null;
  let shown = false;
  const tag = (r: Response) => r.headers.get('etag') || r.headers.get('last-modified') || '';
  async function probe() {
    try {
      const r = await fetch(location.pathname || '/', { method: 'HEAD', cache: 'no-store' });
      const t = tag(r);
      if (!t) return;
      if (seen === null) { seen = t; return; }
      if (t !== seen && !shown) { shown = true; onStale(); }
    } catch {
      /* 오프라인 등 — 다음 기회에 */
    }
  }
  void probe();
  const onVis = () => { if (document.visibilityState === 'visible') void probe(); };
  document.addEventListener('visibilitychange', onVis);
  const timer = setInterval(() => void probe(), intervalMs);
  return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(timer); };
}
