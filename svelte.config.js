import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    // 런타임에 만들어지는 마크업을 줄인다 — CSP script-src 'self' 아래서 eval 류는 어차피 못 쓴다
    runes: true,
  },
};
