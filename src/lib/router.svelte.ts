/**
 * hash 라우터 — `#/m/이름`, `#/rank/metric/dpm/TOP` 같은 경로를 화면과 매개변수로 푼다.
 *
 * hash 를 쓰는 이유: 서버 설정이 0 이고(`not_found_handling="none"` 유지), fragment 는 서버·Referer·
 * Cloudflare 로그에 **전송되지 않아** 소환사명(실명급 식별자)이 로그에 남지 않는다.
 * 라우트 = 상태. 정렬·필터 같은 화면 로컬 상태는 URL 에 두지 않는다.
 */

export type Section = 'home' | 'member' | 'rank' | 'records' | 'synergy' | 'champions' | 'matches' | 'math';

export interface Route {
  section: Section;
  /** 섹션 안 하위 화면 (예: rank 의 board/metric/play). 없으면 섹션 기본 */
  sub: string;
  params: Record<string, string>;
  /** 파싱 실패(모르는 경로) — 홈을 그리되 안내를 띄운다 */
  unknown: boolean;
  raw: string;
}

interface Pattern { re: RegExp; keys: string[]; section: Section; sub: string }

/** 패턴 문자열 `/m/:name/vs/:b` → 정규식. `:x` 는 한 조각, `?` 로 끝나면 선택. */
function compile(pattern: string, section: Section, sub = ''): Pattern {
  const keys: string[] = [];
  const src = pattern
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      if (seg.startsWith(':')) {
        const opt = seg.endsWith('?');
        keys.push(opt ? seg.slice(1, -1) : seg.slice(1));
        return opt ? '(?:/([^/]+))?' : '/([^/]+)';
      }
      return '/' + seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return { re: new RegExp('^' + (src || '/') + '/?$'), keys, section, sub };
}

// 순서가 중요하다 — 앞에서 먼저 맞는 것이 이긴다.
const PATTERNS: Pattern[] = [
  compile('/', 'home'),
  compile('/m/:name/vs/:b', 'member', 'compare'),
  compile('/m/:name', 'member'),
  compile('/rank/board/:lane?', 'rank', 'board'),
  compile('/rank/metric/:key/:lane?', 'rank', 'metric'),
  compile('/rank/play', 'rank', 'play'),
  compile('/rank', 'rank', 'board'),
  compile('/records/:sub?', 'records'),
  compile('/synergy/:sub?', 'synergy'),
  compile('/champions/meta/:lane?', 'champions', 'meta'),
  compile('/champions/:sub?', 'champions'),
  compile('/matches/trend', 'matches', 'trend'),
  compile('/matches/:slug', 'matches', 'detail'),
  compile('/matches', 'matches', 'list'),
  compile('/math/:sub?', 'math'),
];

const DEFAULT_SUB: Partial<Record<Section, string>> = {
  records: 'hall', synergy: 'duo', champions: 'meta', math: 'cp',
};

function decode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const path = raw.startsWith('/') ? raw : '/' + raw;
  for (const p of PATTERNS) {
    const m = p.re.exec(path);
    if (!m) continue;
    const params: Record<string, string> = {};
    p.keys.forEach((k, i) => { const v = m[i + 1]; if (v !== undefined) params[k] = decode(v); });
    let sub = p.sub;
    if (!sub && params.sub) { sub = params.sub; delete params.sub; }
    if (!sub) sub = DEFAULT_SUB[p.section] ?? '';
    return { section: p.section, sub, params, unknown: false, raw: path };
  }
  return { section: 'home', sub: '', params: {}, unknown: true, raw: path };
}

/** 경로 조립 — 이름 등 사용자 문자열은 여기서 인코딩한다. */
export function href(parts: (string | number)[]): string {
  return '#/' + parts.map((p) => encodeURIComponent(String(p))).join('/');
}
export const memberHref = (name: string) => href(['m', name]);
export const compareHref = (a: string, b: string) => href(['m', a, 'vs', b]);
export const matchHref = (slug: string) => href(['matches', slug]);
export const metricHref = (key: string, lane?: string) => href(lane ? ['rank', 'metric', key, lane] : ['rank', 'metric', key]);

class Router {
  route = $state<Route>(parseHash(typeof location !== 'undefined' ? location.hash : ''));
  private off: (() => void) | null = null;

  start(): void {
    if (this.off || typeof window === 'undefined') return;
    const onChange = () => { this.route = parseHash(location.hash); };
    window.addEventListener('hashchange', onChange);
    onChange();
    this.off = () => window.removeEventListener('hashchange', onChange);
  }
  stop(): void { this.off?.(); this.off = null; }

  go(hash: string): void {
    if (location.hash === hash) { this.route = parseHash(hash); return; }
    location.hash = hash;
  }
}

export const router = new Router();
