const PLAYER_CLASS_NAME = 'minus115-video-player';
const PLAYER_PAGE_CLASS_NAME = 'minus115-video-player-page';
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
    throw new Error('115- 铺满视频播放器失败：video 元素缺少父容器');
  }
  return player;
};

export const setupVideoPlayer = (): void => {
  document.documentElement.classList.add(PLAYER_PAGE_CLASS_NAME);

  let boundVideo: HTMLVideoElement | null = null;
  let player: HTMLElement | null = null;
  let volumeController: AbortController | null = null;
  let restoreTimer: number | null = null;

  const bindVideo = (video: HTMLVideoElement): void => {
    volumeController?.abort();
    if (restoreTimer !== null) {
      window.clearTimeout(restoreTimer);
    }
    player?.classList.remove(PLAYER_CLASS_NAME);

    const storedMuted = readStoredMuted();
    const storedVolume = readStoredVolume();
    const nextPlayer = resolvePlayer(video);
    const nextVolumeController = new AbortController();
    video.muted = storedMuted;
    video.volume = storedVolume;
    nextPlayer.classList.add(PLAYER_CLASS_NAME);

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
    player = nextPlayer;
    volumeController = nextVolumeController;
  };

  const sync = (): void => {
    const video = document.querySelector('video');
    if (!(video instanceof HTMLVideoElement) || video === boundVideo) {
      return;
    }
    bindVideo(video);
  };

  sync();
  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
};
