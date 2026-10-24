import { errorMessage } from '@/core/errors';
import { downloadFileInBrowser } from '@/features/download/browser-download';
import {
  pushSelectedToAria2,
  pushSelectedToIdm,
  type TransferResult,
} from '@/features/download/selected-downloads';
import { settings } from '@/features/settings/settings-store';
import {
  findFileItemDownloadButton,
  getFileFromListItem,
  getSelectedFiles,
} from '@/platform/115/storage-selection';
import { openOfficialOfflineDownload } from '@/platform/115/storage-toolbar';
import type { NotificationKind } from '@/ui/notifications';
import type { StorageEntry } from '@/platform/115/storage-entry';

export interface StoragePageActions {
  openFileDownload(selected: readonly StorageEntry[]): void;
  openSettings(): void;
  showNotification(kind: NotificationKind, message: string): void;
}

export const createSettingsButton = (app: StoragePageActions): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '115- 设置';
  button.addEventListener('click', () => app.openSettings());
  button.id = 'minus115-settings';
  return button;
};

const findToolbarButtonTemplate = (target: HTMLElement): HTMLButtonElement | null => {
  for (const item of Array.from(target.children).reverse()) {
    const button =
      item instanceof HTMLButtonElement
        ? item
        : item.querySelector<HTMLButtonElement>(':scope > button');
    if (button && !button.id.startsWith('minus115-')) {
      return button;
    }
  }
  return null;
};

export const createOfflineButton = (
  target: HTMLElement,
  app: StoragePageActions,
  signal: AbortSignal,
): HTMLButtonElement => {
  const source = findToolbarButtonTemplate(target);
  if (!source) {
    throw new Error('115- 创建离线下载按钮失败：控制栏中没有模板按钮');
  }

  const button = source.cloneNode(true) as HTMLButtonElement;
  const label = document.createElement('span');
  const icon = document.createElement('i');
  icon.className = 'icon-operate black ifo-linktask';
  label.textContent = '离线下载';
  button.replaceChildren(icon, label);
  button.disabled = false;
  button.removeAttribute('aria-expanded');
  button.removeAttribute('aria-haspopup');
  button.removeAttribute('aria-label');
  button.removeAttribute('title');
  button.id = 'minus115-offline';
  button.type = 'button';
  button.addEventListener('click', () => {
    if (button.disabled) {
      return;
    }
    button.disabled = true;
    void openOfficialOfflineDownload(signal)
      .catch((error: unknown) => {
        if (signal.aborted) return;
        console.error('115- 打开官方离线下载弹窗失败', { error });
        app.showNotification('error', errorMessage(error));
      })
      .finally(() => {
        button.disabled = false;
      });
  });
  return button;
};

const bindTransferAction = (
  button: HTMLButtonElement,
  app: StoragePageActions,
  labelText: string,
  action: (files: StorageEntry[]) => Promise<TransferResult>,
  signal: AbortSignal,
): void => {
  const label = button.querySelector<HTMLSpanElement>(':scope > span');
  if (!label) {
    throw new Error(`115- 绑定“${labelText}”失败：按钮缺少文字节点`);
  }
  let selectionKey = '';
  let failedFiles: StorageEntry[] = [];
  let succeeded = 0;
  button.addEventListener('click', () => {
    if (button.disabled) {
      return;
    }
    let selected: StorageEntry[];
    try {
      selected = getSelectedFiles();
    } catch (error) {
      app.showNotification('error', errorMessage(error));
      return;
    }
    const nextKey = JSON.stringify(selected.map((file) => `${file.isDirectory}:${file.id}`).sort());
    if (nextKey !== selectionKey) {
      selectionKey = nextKey;
      failedFiles = [];
      succeeded = 0;
    }
    button.disabled = true;
    label.textContent = '处理中…';
    void action(failedFiles.length > 0 ? failedFiles : selected)
      .then((result) => {
        if (signal.aborted) return;
        succeeded += result.succeeded;
        failedFiles = result.failed.map((failure) => failure.file);
        const failure = result.failed[0];
        if (failure) {
          app.showNotification(
            'error',
            `${labelText} 已成功 ${succeeded} 个，失败 ${failedFiles.length} 个。${failure.file.name}：${failure.message}`,
          );
          return;
        }
        app.showNotification('success', `${labelText} 已处理 ${succeeded} 个文件`);
        selectionKey = '';
        succeeded = 0;
      })
      .catch((error: unknown) => {
        if (signal.aborted) return;
        console.error('115- 批量推送失败', { action: labelText, error });
        app.showNotification('error', errorMessage(error));
      })
      .finally(() => {
        button.disabled = false;
        label.textContent = failedFiles.length > 0 ? `${labelText}（重试失败项）` : labelText;
      });
  });
};

const createMenuButton = (id: string, labelText: string): HTMLButtonElement => {
  const button = document.createElement('button');
  button.id = id;
  button.type = 'button';
  button.className =
    'w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2';
  const label = document.createElement('span');
  label.textContent = labelText;
  button.append(label);
  return button;
};

const runBrowserDownload = (
  button: HTMLButtonElement,
  pickCode: string,
  app: StoragePageActions,
  signal: AbortSignal,
): void => {
  if (button.disabled) {
    return;
  }
  button.disabled = true;
  void downloadFileInBrowser(pickCode, signal)
    .catch((error: unknown) => {
      if (signal.aborted) return;
      console.error('115- 浏览器下载失败', { error });
      app.showNotification('error', errorMessage(error));
    })
    .finally(() => {
      button.disabled = false;
    });
};

const handleSelectedBrowserDownload = (
  button: HTMLButtonElement,
  app: StoragePageActions,
  signal: AbortSignal,
): void => {
  try {
    const selected = getSelectedFiles();
    const file = selected[0];
    if (selected.length === 1 && file && !file.isDirectory) {
      runBrowserDownload(button, file.pickCode, app, signal);
      return;
    }
    if (selected.length === 0) throw new Error('请选择需要下载的文件或文件夹');
    app.openFileDownload(selected);
  } catch (error) {
    console.error('115- 读取选中文件失败', { error });
    app.showNotification('error', errorMessage(error));
  }
};

export const createSelectionDownload = (
  template: HTMLButtonElement,
  app: StoragePageActions,
  signal: AbortSignal,
): HTMLDivElement => {
  const wrapper = document.createElement('div');
  wrapper.className = template.parentElement?.className || 'relative';

  const trigger = template.cloneNode(true) as HTMLButtonElement;
  trigger.id = 'minus115-download';
  trigger.type = 'button';
  trigger.disabled = false;
  trigger.removeAttribute('aria-label');
  trigger.removeAttribute('title');
  trigger.classList.add('gap-1');
  const icon = trigger.querySelector<HTMLElement>(':scope > i');
  if (icon) {
    icon.className = 'icon-operate ifo-download';
  }
  const labels = Array.from(trigger.querySelectorAll<HTMLSpanElement>(':scope > span'));
  const label = labels.at(-1);
  if (!label) {
    throw new Error('115- 创建直链下载按钮失败：模板按钮缺少文字节点');
  }
  label.textContent = '直链下载';
  const arrow =
    trigger.querySelector<HTMLImageElement>(':scope > img') ?? document.createElement('img');
  arrow.alt = '';
  arrow.width = 12;
  arrow.height = 12;
  arrow.className = 'transition-transform';
  arrow.src = '/arrow_down_small.svg';
  trigger.append(arrow);

  const getLinkButton = createMenuButton('minus115-get-link', '浏览器下载');
  getLinkButton.addEventListener('click', () =>
    handleSelectedBrowserDownload(getLinkButton, app, signal),
  );
  const aria2Button = createMenuButton('minus115-aria2', '推送Aria2');
  bindTransferAction(
    aria2Button,
    app,
    '推送Aria2',
    (files) =>
      pushSelectedToAria2(
        files,
        {
          rpcUrl: settings.aria2RpcUrl,
          secret: settings.aria2Secret,
        },
        signal,
      ),
    signal,
  );
  const idmButton = createMenuButton('minus115-idm', '推送IDM');
  bindTransferAction(
    idmButton,
    app,
    '推送IDM',
    (files) => pushSelectedToIdm(files, { clientId: settings.idmClientId }, signal),
    signal,
  );

  const menuSurface = document.createElement('div');
  menuSurface.className = 'py-1 bg-white border border-gray-200 rounded-lg shadow-lg';
  menuSurface.append(getLinkButton, aria2Button, idmButton);
  const menu = document.createElement('div');
  menu.className = 'absolute top-full left-0 pt-1 w-40 z-50';
  menu.hidden = true;
  menu.append(menuSurface);

  const setOpen = (open: boolean): void => {
    menu.hidden = !open;
    arrow.classList.toggle('rotate-180', open);
  };
  wrapper.addEventListener('mouseenter', () => setOpen(true));
  wrapper.addEventListener('mouseleave', () => setOpen(false));
  wrapper.addEventListener('focusin', () => setOpen(true));
  wrapper.addEventListener('focusout', (event) => {
    if (!wrapper.contains(event.relatedTarget as Node | null)) setOpen(false);
  });
  trigger.addEventListener('click', () => handleSelectedBrowserDownload(trigger, app, signal));
  menu.addEventListener('click', () => setOpen(false));
  wrapper.append(trigger, menu);
  return wrapper;
};

export const setupFileItemDownload = (app: StoragePageActions, signal: AbortSignal): void => {
  document.addEventListener(
    'click',
    (event) => {
      const button = findFileItemDownloadButton(event.target);
      if (!button) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (button.disabled) {
        return;
      }

      try {
        const file = getFileFromListItem(button);
        if (file.isDirectory) app.openFileDownload([file]);
        else runBrowserDownload(button, file.pickCode, app, signal);
      } catch (error) {
        console.error('115- 读取列表项文件失败', { error });
        app.showNotification('error', errorMessage(error));
        return;
      }
    },
    { capture: true, signal },
  );
};
