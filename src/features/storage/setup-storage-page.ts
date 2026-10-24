import { observePage } from '@/core/dom';
import {
  createOfflineButton,
  createSelectionDownload,
  createSettingsButton,
  setupFileItemDownload,
  type StoragePageActions,
} from '@/features/storage/storage-page-controls';
import { FILE_CHECKBOX_SELECTOR, getSelectedFileCount } from '@/platform/115/storage-selection';
import { setupAside } from '@/platform/115/storage-sidebar';
import {
  findOfflineToolbarTarget,
  findSelectionDownloadTarget,
  findSettingsTarget,
  mountDownloadMenu,
} from '@/platform/115/storage-toolbar';

const attachButton = (
  button: HTMLElement | null,
  target: HTMLElement | null,
  create: (target: HTMLElement) => HTMLElement,
): HTMLElement | null => {
  if (!target) {
    button?.remove();
    return button;
  }
  const element = button ?? create(target);
  if (element.parentElement !== target) target.append(element);
  return element;
};

export const setupStoragePage = (app: StoragePageActions, signal: AbortSignal): (() => void) => {
  setupFileItemDownload(app, signal);
  const syncAside = setupAside(signal);
  let settingsButton: HTMLElement | null = null;
  let offlineButton: HTMLElement | null = null;
  let downloadMenu: HTMLDivElement | null = null;
  let downloadTarget: HTMLButtonElement | null = null;
  let restoreDownload: (() => void) | null = null;

  const refresh = observePage(() => {
    syncAside();
    settingsButton = attachButton(settingsButton, findSettingsTarget(), () =>
      createSettingsButton(app),
    );
    offlineButton = attachButton(offlineButton, findOfflineToolbarTarget(), (target) =>
      createOfflineButton(target, app, signal),
    );
    const target = getSelectedFileCount() > 0 ? findSelectionDownloadTarget() : null;
    if (target === downloadTarget && (!target || downloadMenu?.isConnected)) return;
    restoreDownload?.();
    restoreDownload = null;
    downloadTarget = target;
    if (target) {
      downloadMenu ??= createSelectionDownload(target, app, signal);
      restoreDownload = mountDownloadMenu(target, downloadMenu);
    }
  }, signal);

  document.addEventListener(
    'change',
    (event) => {
      if (
        event.target instanceof HTMLInputElement &&
        event.target.matches(FILE_CHECKBOX_SELECTOR)
      ) {
        refresh();
      }
    },
    { capture: true, signal },
  );
  signal.addEventListener(
    'abort',
    () => {
      settingsButton?.remove();
      offlineButton?.remove();
      restoreDownload?.();
    },
    { once: true },
  );
  return refresh;
};
