import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // Svelte 5 컴포넌트를 jsdom 에서 mount 하려면 브라우저 조건으로 해석해야 한다
    server: { deps: { inline: ['@testing-library/svelte'] } },
  },
  resolve: {
    conditions: ['browser'],
  },
}));
