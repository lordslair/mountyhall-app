import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Shown when a new service worker is available (registerType: prompt).
 * Lets installed PWA / tab users load the new precache (HTML/JS including HELP.md bundle).
 */
export default function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      console.warn('PWA service worker registration failed', err);
    },
  });

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="pwa-update-banner" role="alert">
      <span className="pwa-update-banner-text">
        Une nouvelle version est disponible. Actualisez pour obtenir les derniers contenus (aide, correctifs…).
      </span>
      <div className="pwa-update-banner-actions">
        <button
          type="button"
          className="btn btn-primary pwa-update-btn"
          onClick={() => {
            void updateServiceWorker();
          }}
        >
          Actualiser
        </button>
        <button
          type="button"
          className="btn btn-secondary pwa-update-btn"
          onClick={() => setNeedRefresh(false)}
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
