import { setupVideoPlayer } from '@/features/player/setup-video-player';
import { Minus115App } from '@/app/minus115-app';
import {
  applyStoragePageDefaults,
  redirectLegacyStoragePage,
} from '@/features/storage/storage-page-defaults';
import { setupStoragePage } from '@/features/storage/setup-storage-page';
import '@/features/ad-block/ad-block.css';
import '@/features/player/video-player.css';

const isVideoPlayerPage = window.location.pathname.startsWith('/players/video/');
const isStoragePage =
  window.location.pathname === '/storage' || window.location.pathname.startsWith('/storage/');

const setupCurrentPage = (): void => {
  if (isVideoPlayerPage) {
    setupVideoPlayer();
  } else if (isStoragePage) {
    const app = new Minus115App();
    document.body.appendChild(app);
    setupStoragePage(app);
  }
};

if (window.top === window.self && !redirectLegacyStoragePage()) {
  if (isStoragePage) {
    applyStoragePageDefaults();
  }
  if (document.body) {
    setupCurrentPage();
  } else {
    document.addEventListener('DOMContentLoaded', setupCurrentPage, { once: true });
  }
}
