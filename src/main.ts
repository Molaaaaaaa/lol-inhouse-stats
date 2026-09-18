import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

// CSP 가 인라인 핸들러(onerror=)를 막으므로, 못 받은 챔프·아이템 이미지는 여기서 숨긴다.
// error 는 버블링하지 않아 캡처 단계로 받는다.
document.addEventListener('error', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLImageElement)) return;
  if (t.classList.contains('champ')) t.style.display = 'none';
  else if (t.classList.contains('itemslot')) t.style.visibility = 'hidden';
}, true);

mount(App, { target: document.getElementById('app')! });
