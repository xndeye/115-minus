import { settings } from '@/features/settings/settings-store';

const WEB_FULLSCREEN_BUTTON_SELECTOR = 'button[aria-label="网页全屏"]';
const MUTED_STORAGE_KEY = 'video-muted';
const VOLUME_STORAGE_KEY = 'video-volume';
const DEFAULT_MUTED = false;
const DEFAULT_VOLUME = 1;

const readStoredMuted = (): boolean => {
  const stored = GM_getValue<unknown>(MUTED_STORAGE_KEY, DEFAULT_MUTED);
  return typeof stored === 'boolean' ? stored : DEFAULT_MUTED;
};

const readStoredVolume = (): number => {
  const stored = GM_getValue<unknown>(VOLUME_STORAGE_KEY, DEFAULT_VOLUME);
  return typeof stored === 'number' && Number.isFinite(stored) && stored >= 0 && stored <= 1
    ? stored
    : DEFAULT_VOLUME;
};

export const setupVideoPlayer = (): void => {
  let boundVideo: HTMLVideoElement | null = null;
  let volumeController: AbortController | null = null;
  let restoreTimer: number | null = null;
  let webFullscreenRequested = false;

  const bindVideo = (video: HTMLVideoElement): void => {
    volumeController?.abort();
    if (restoreTimer !== null) {
      window.clearTimeout(restoreTimer);
    }
    const storedMuted = readStoredMuted();
    const storedVolume = readStoredVolume();
    const nextVolumeController = new AbortController();
    video.muted = storedMuted;
    video.volume = storedVolume;

    restoreTimer = window.setTimeout(() => {
      if (!video.isConnected) {
        return;
      }
      video.muted = storedMuted;
      video.volume = storedVolume;
      video.addEventListener(
        'volumechange',
        () => {
          GM_setValue(MUTED_STORAGE_KEY, video.muted);
          GM_setValue(VOLUME_STORAGE_KEY, video.volume);
        },
        { signal: nextVolumeController.signal },
      );
      restoreTimer = null;
    }, 0);

    boundVideo = video;
    volumeController = nextVolumeController;
  };

  const enterWebFullscreen = (): void => {
    if (!settings.webFullscreen || webFullscreenRequested) {
      return;
    }
    const button = document.querySelector(WEB_FULLSCREEN_BUTTON_SELECTOR);
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    webFullscreenRequested = true;
    button.click();
  };

  const sync = (): void => {
    const video = document.querySelector('video');
    if (video instanceof HTMLVideoElement && video !== boundVideo) {
      bindVideo(video);
    }
    enterWebFullscreen();
  };

  sync();
  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
};
