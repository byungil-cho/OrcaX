if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'PRECACHED') {
      const t = document.getElementById('toast');
      if (t){ t.textContent = `오프라인 저장 완료 (${e.data.count}개)`; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1500); }
    }
  });
}