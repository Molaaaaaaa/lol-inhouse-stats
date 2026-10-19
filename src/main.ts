import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import DesignSwitch from '$components/DesignSwitch.svelte';

// CSP 가 인라인 핸들러(onerror=)를 막으므로, 못 받은 챔프·아이템 이미지는 여기서 숨긴다.
// error 는 버블링하지 않아 캡처 단계로 받는다.
document.addEventListener('error', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLImageElement)) return;
  if (t.classList.contains('champ')) t.style.display = 'none';
  else if (t.classList.contains('itemslot')) t.style.visibility = 'hidden';
}, true);

mount(App, { target: document.getElementById('app')! });

// 이중 디자인 빌드(2안, /v2/)에서만: 헤더 오른쪽 끝에 '디자인 1안 · 2안'(vite.config.ts).
// App.svelte 마크업에 넣지 않고 여기서 붙이는 이유: 꺼진 빌드에서는 이 줄과 컴포넌트가 통째로 빠져
// 지금 dist(라이엇 제출용)가 바이트 단위로 그대로다. 헤더는 App 이 동기로 그린 정적 마크업이라 이미 있다.
if (__SITE_V2__) mount(DesignSwitch, { target: document.querySelector('header.top')! });
