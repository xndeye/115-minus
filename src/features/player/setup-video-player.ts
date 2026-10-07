import { settings } from '@/features/settings/settings-store';

const WEB_FULLSCREEN_ICON_SELECTOR =
  'img[src$="/images/players/video_player/web_full_screen.svg"]';
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

const resolvePlayer = (video: HTMLVideoElement): HTMLElement => {
  const player = video.parentElement;
  if (!player) {
    throw new Error('115- 进入网页全屏失败：video 元素缺少播放器容器');
  }
  return player;
};

const enterWebFullscreen = (video: HTMLVideoElement, signal: AbortSignal): void => {
  const enter = (): void => {
    window.requestAnimationFrame(() => {
      if (signal.aborted) {
        return;
      }
      const icon = resolvePlayer(video).querySelector(WEB_FULLSCREEN_ICON_SELECTOR);
      const button = icon?.closest('button');
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error('115- 进入网页全屏失败：未找到原站网页全屏按钮');
      }
      button.click();
    });
  };

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    enter();
  } else {
    video.addEventListener('loadedmetadata', enter, { once: true, signal });
  }
};

export const setupVideoPlayer = (): void => {
  let boundVideo: HTMLVideoElement | null = null;
  let videoController: AbortController | null = null;
  let restoreTimer: number | null = null;

  const bindVideo = (video: HTMLVideoElement): void => {
    videoController?.abort();
    if (restoreTimer !== null) {
      window.clearTimeout(restoreTimer);
    }
    const storedMuted = readStoredMuted();
    const storedVolume = readStoredVolume();
    const nextVideoController = new AbortController();
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
        { signal: nextVideoController.signal },
      );
      restoreTimer = null;
    }, 0);

    if (settings.webFullscreen) {
      enterWebFullscreen(video, nextVideoController.signal);
    }

    boundVideo = video;
    videoController = nextVideoController;
  };

  const sync = (): void => {
    const video = document.querySelector('video');
    if (video instanceof HTMLVideoElement && video !== boundVideo) {
      bindVideo(video);
    }
  };

  sync();
  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
};
