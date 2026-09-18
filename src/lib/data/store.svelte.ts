/**
 * 앱 전역 상태 — 색인·선택 길드·페이로드·로딩/오류. Svelte 5 runes 모듈.
 * 화면 로컬 상태(정렬·필터·라인 선택)는 각 컴포넌트가 들고, 딥링크 가치가 있는 것만 URL 에 둔다.
 */
import { LazyFiles, LoadError, LOAD_FAIL, NO_DATA, loadGuild, loadIndex } from './loader';
import type { GuildIndexEntry, GuildPayload, PlayerPub } from './types';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface AppError {
  message: string;
  retry: (() => void) | null;
}

class AppStore {
  index = $state<GuildIndexEntry[]>([]);
  gid = $state('');
  data = $state<GuildPayload | null>(null);
  status = $state<LoadState>('idle');
  error = $state<AppError | null>(null);
  lazy = $state<LazyFiles | null>(null);

  /** 표시명 → 멤버 키. 동명이인은 payload 의 `tag` 로 `이름~2` 처럼 갈라진다. */
  nameToKey = $derived.by(() => {
    const m = new Map<string, string>();
    if (!this.data) return m;
    for (const [k, p] of Object.entries(this.data.players)) m.set(displayName(p), k);
    return m;
  });

  /** 문턱은 발행 쪽 min_games 를 따른다 — 화면이 따로 정하면 반드시 어긋난다. */
  minGames = $derived(this.data?.min_games ?? 5);
  minGamesLane = $derived(this.data?.min_games_lane ?? 3);

  async boot(): Promise<void> {
    this.status = 'loading';
    this.error = null;
    try {
      const idx = await loadIndex();
      if (!idx.length) { this.fail(NO_DATA, null); return; }
      this.index = idx;
      await this.select(idx[0]!.id);
    } catch (e) {
      this.fail(e instanceof LoadError && e.status === 404 ? NO_DATA : LOAD_FAIL, () => void this.boot());
    }
  }

  async select(gid: string): Promise<void> {
    this.status = 'loading';
    this.error = null;
    try {
      const d = await loadGuild(gid);
      this.gid = gid;
      this.data = d;
      this.lazy = new LazyFiles(gid);   // 길드가 바뀌면 상세·데스 캐시도 새로
      this.status = 'ready';
    } catch (e) {
      this.fail(e instanceof LoadError && e.status === undefined ? e.message : LOAD_FAIL, () => void this.select(gid));
    }
  }

  /** 헤더 새로고침 버튼 — 같은 길드를 다시 받는다(재검증 fetch 라 안 바뀌었으면 304). */
  reload(): void {
    if (this.gid) void this.select(this.gid);
  }

  private fail(message: string, retry: (() => void) | null) {
    this.status = 'error';
    this.error = { message, retry };
  }

  player(name: string): { key: string; p: PlayerPub } | null {
    const key = this.nameToKey.get(name);
    if (!key || !this.data) return null;
    const p = this.data.players[key];
    return p ? { key, p } : null;
  }
}

/** 표시명 — 동명이인이면 `이름~순번`. 딥링크(`#/m/이름`)에 그대로 쓴다. */
export function displayName(p: PlayerPub): string {
  return p.tag ? `${p.name}~${p.tag}` : p.name;
}

export const app = new AppStore();
