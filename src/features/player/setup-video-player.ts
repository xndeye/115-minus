import { settings } from '@/features/settings/settings-store';
import { observePage } from '@/core/dom';

const VOLUME_CONTROLS_SELECTOR = '[class~="group/volume"]';
const MUTED_STORAGE_KEY = 'video-muted';
const VOLUME_STORAGE_KEY = 'video-volume';
const DEFAULT_MUTED = false;
const DEFAULT_VOLUME = 1;
const FULLSCREEN_TIMEOUT_MS = 5_000;

type VolumeProperty = 'muted' | 'volume';

const readStoredMuted = (): boolean => {
  const stored = GM_getValue<unknown>(MUTED_STORAGE_KEY, DEFAULT_MUTED);
  return typeof stored === 'boolean' ? stored : DEFAULT_MUTED;
};

const readStoredVolume = (): number => {
  const stored = GM_getValue<unknown>(VOLUME_STORAGE_KEY, DEFAULT_VOLUME);
  return typeof stored === 'number' && stored >= 0 && stored <= 1 ? stored : DEFAULT_VOLUME;
};

const resolvePlayer = (video: HTMLVideoElement): HTMLElement => {
  const player = video.parentElement;
  if (!player) {
    throw new Error('115- 初始化播放器失败：video 元素缺少播放器容器');
  }
  return player;
};

const resolveVolumeProperty = (event: Event, player: HTMLElement): VolumeProperty | null => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }

  if (event instanceof KeyboardEvent) {
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return null;
    }
    switch (event.key.toLowerCase()) {
      case 'arrowup':
      case 'arrowdown':
        return 'volume';
      case 'm':
        return 'muted';
      default:
        return null;
    }
  }

  const controls = target.closest(VOLUME_CONTROLS_SELECTOR);
  if (!controls || !player.contains(controls)) {
    return null;
  }
  if (event.type === 'input' && target instanceof HTMLInputElement && target.type === 'range') {
    return 'volume';
  }
  if (event.type === 'click' && target.closest('button')) {
    return 'muted';
  }
  return null;
};

const setupVolumeMemory = (video: HTMLVideoElement, signal: AbortSignal): void => {
  const player = resolvePlayer(video);
  video.muted = readStoredMuted();
  video.volume = readStoredVolume();
  const syncVolume = (): void => {
    video.dispatchEvent(new Event('volumechange'));
  };
  video.addEventListener('loadedmetadata', syncVolume, { signal });
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) syncVolume();

  const remember = (event: Event): void => {
    if (!event.isTrusted || !video.isConnected) {
      return;
    }
    const property = resolveVolumeProperty(event, player);
    if (!property) {
      return;
    }
    const previous = video[property];
    // 等原站处理完本次交互，只保存用户操作的属性，排除原站自动静音。
    window.setTimeout(() => {
      if (
        signal.aborted ||
        !video.isConnected ||
        (event instanceof KeyboardEvent && !event.defaultPrevented)
      ) {
        return;
      }
      const value = video[property];
      if (value !== previous) {
        GM_setValue(property === 'muted' ? MUTED_STORAGE_KEY : VOLUME_STORAGE_KEY, value);
      }
    }, 0);
  };

  window.addEventListener('input', remember, { capture: true, signal });
  window.addEventListener('click', remember, { capture: true, signal });
  window.addEventListener('keydown', remember, { capture: true, signal });
};

export const setupVideoPlayer = (signal: AbortSignal): (() => void) => {
  let video: HTMLVideoElement | null = null;
  let videoController: AbortController | null = null;
  let fullscreenPending = settings.webFullscreen;
  let fullscreenDeadline = 0;

  window.addEventListener(
    'keydown',
    (event) => {
      if (
        event.isTrusted &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        (event.key.toLowerCase() === 'w' || event.key === 'Escape')
      )
        fullscreenPending = false;
    },
    { capture: true, signal },
  );

  const refresh = observePage(() => {
    const current = document.querySelector('video');
    if (current !== video) {
      videoController?.abort();
      video = current;
      videoController = video ? new AbortController() : null;
      fullscreenDeadline = performance.now() + FULLSCREEN_TIMEOUT_MS;
      if (video && videoController) setupVolumeMemory(video, videoController.signal);
    }
    if (!video || !fullscreenPending) return;
    if (resolvePlayer(video).classList.contains('fixed') || document.fullscreenElement) {
      fullscreenPending = false;
      return;
    }
    // 原站页面级 W 快捷键直接更新全屏状态，无需等待控制栏。
    const event = new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', cancelable: true });
    window.dispatchEvent(event);
    if (event.defaultPrevented) fullscreenPending = false;
    else if (performance.now() >= fullscreenDeadline) {
      fullscreenPending = false;
      throw new Error('115- 进入网页全屏失败：原站未响应 W 快捷键');
    } else refresh();
  }, signal);
  signal.addEventListener('abort', () => videoController?.abort(), { once: true });
  return refresh;
};
