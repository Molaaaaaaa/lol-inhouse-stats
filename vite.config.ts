import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath, URL } from 'node:url';

// ⚠️ 인라인 <script> 가 생기면 CSP(script-src 'self') 에 막혀 라이브가 백지가 된다.
//    그래서 legacy·pwa·html 플러그인을 쓰지 않고 자산 인라인도 끈다.
//    관문(inhouse/gate.build_blockers)이 dist/index.html 의 인라인 스크립트 0 을 확인한다.
export default defineConfig({
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
