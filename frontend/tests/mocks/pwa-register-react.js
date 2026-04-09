/**
 * Vitest stub: real module is `virtual:pwa-register/react` (vite-plugin-pwa).
 */
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: async () => {},
  }
}
