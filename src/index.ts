// polyfills
import 'web-animations-js/web-animations.min';
import 'element-remove-polyfill';

// styles
import '@styles/index.scss';

// main
import '@js/app';

// PWA
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  // 새 버전이 배포되면 화면을 한 번 새로 불러와 옛 화면이 계속 보이지 않게 한다.
  // (처음 방문이거나 추첨 연출이 진행 중일 때는 새로 불러오지 않는다)
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const drawButton = document.getElementById('draw-button') as HTMLButtonElement | null;
    if (!hadController || reloaded || (drawButton && drawButton.disabled)) {
      return;
    }
    reloaded = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').then((registration) => {
      console.info('SW registered: ', registration);
    }).catch((registrationError) => {
      console.info('SW registration failed: ', registrationError);
    });
  });
}
