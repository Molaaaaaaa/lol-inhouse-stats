import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath, URL } from 'node:url';

/**
 * 이중 디자인 빌드(2안) — `INHOUSE_SITE_V2=1` 이면 사이트의 `/v2/` 아래에 놓일 판을 만든다
 * (`scripts/build_site_v2.py` 가 켠다). 1안(옛 UI)은 사이트 루트에 있고, 둘은 같은 발행 JSON(`/data/`)을 읽는다.
 *   · base `/v2/` — 자산·지연 청크 경로가 `/v2/assets/…` 가 된다. 화면 이동은 hash 라 페이지는 `/v2/` 하나다.
 *   · `__DATA_DIR__` `/data/` — 사이트 루트의 공유 발행물. 꺼지면 페이지 옆 `data/`(상대 경로) 그대로.
 *     화면은 사다리 키(ratings·cp…)를 읽지 않으므로 옛 레이아웃 발행물(그 키가 실려 있다)을 그대로 읽어도 된다.
 *   · `__SITE_V2__` — 헤더 오른쪽 끝에 '디자인 1안 · 2안' 전환을 붙인다(`src/main.ts`).
 *   · `public/`(data·_headers·riot.txt·robots.txt)은 복사하지 않는다 — 사이트 루트의 것을 쓴다.
 * 꺼진 빌드(지금 dist·라이엇 제출용)에서는 두 값이 상수로 접혀 산출물이 바이트 단위로 같다(실측).
 */
const SITE_V2 = process.env.INHOUSE_SITE_V2 === '1';

// ⚠️ 인라인 <script> 가 생기면 CSP(script-src 'self') 에 막혀 라이브가 백지가 된다.
//    그래서 legacy·pwa·html 플러그인을 쓰지 않고 자산 인라인도 끈다.
//    관문(inhouse/gate.build_blockers)이 dist/index.html 의 인라인 스크립트 0 을 확인한다.
export default defineConfig({
  base: SITE_V2 ? '/v2/' : '/',
  define: {
    __SITE_V2__: JSON.stringify(SITE_V2),
    __DATA_DIR__: JSON.stringify(SITE_V2 ? '/data/' : 'data/'),
  },
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      $components: fileURLToPath(new URL('./src/components', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    sourcemap: false,
    copyPublicDir: !SITE_V2,
    // 결정적 산출물: 같은 소스면 같은 파일명·내용 → 야간 발행 커밋에 churn 이 없다
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
