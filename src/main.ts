import { setupVideoPlayer } from '@/features/player/setup-video-player';
import { Minus115App } from '@/app/minus115-app';
import {
  applyStoragePageDefaults,
  redirectLegacyStoragePage,
} from '@/features/storage/storage-page-defaults';
import { setupStoragePage } from '@/features/storage/setup-storage-page';
import '@/features/ad-block/ad-block.css';

type PageKind = 'storage' | 'video' | null;

interface ActivePage {
  kind: Exclude<PageKind, null>;
  controller: AbortController;
  refresh: () => void;
}

const resolvePage = (): PageKind => {
  const { pathname } = window.location;
  if (pathname.startsWith('/players/video/')) {
    return 'video';
  }
  return pathname === '/storage' || pathname.startsWith('/storage/') ? 'storage' : null;
};

const setupNavigation = (): void => {
  let page: ActivePage | null = null;
  let scheduled = false;

  const syncCurrentPage = (): void => {
    if (!document.body || redirectLegacyStoragePage()) {
      return;
    }
    const nextPage = resolvePage();
    if (nextPage === (page?.kind ?? null)) {
      page?.refresh();
      return;
    }
    page?.controller.abort();
    page = null;
    if (!nextPage) {
      return;
    }
    const controller = new AbortController();
    let refresh: () => void;
    if (nextPage === 'video') {
      refresh = setupVideoPlayer(controller.signal);
    } else {
      applyStoragePageDefaults();
      const app = new Minus115App();
      document.body.appendChild(app);
      controller.signal.addEventListener('abort', () => app.remove(), { once: true });
      refresh = setupStoragePage(app, controller.signal);
    }
    page = { kind: nextPage, controller, refresh };
  };

  const scheduleSync = (): void => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      syncCurrentPage();
    });
  };

  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method];
    window.history[method] = function (...args: Parameters<History[typeof method]>): void {
      original.apply(this, args);
      scheduleSync();
    };
  }
  window.addEventListener('popstate', scheduleSync);
  if (document.body) {
    syncCurrentPage();
  } else {
    document.addEventListener('DOMContentLoaded', syncCurrentPage, { once: true });
  }
};

if (!redirectLegacyStoragePage()) {
  if (resolvePage() === 'storage') {
    applyStoragePageDefaults();
  }
  setupNavigation();
}
