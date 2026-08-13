import { errorMessage } from '@/core/errors';
import { pushSelectedToAria2, pushSelectedToIdm } from '@/features/download/selected-downloads';
import { settings } from '@/features/settings/settings-store';
import { getSelectedFiles } from '@/platform/115/storage-selection';
import { findUploadButton, openOfficialOfflineDownload } from '@/platform/115/storage-toolbar';
import type { NotificationKind } from '@/ui/notifications';

export interface StoragePageActions {
  openFileDownload(): void;
  openSettings(): void;
  showNotification(kind: NotificationKind, message: string): void;
}

const createButton = (label: string, onClick: () => void): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
};

export const createSettingsButton = (app: StoragePageActions): HTMLButtonElement => {
  const button = createButton('115- 设置', () => app.openSettings());
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

const createToolbarButton = (
  target: HTMLElement,
  id: string,
  labelText: string,
  iconClass: string | null,
): HTMLButtonElement => {
  const source = findToolbarButtonTemplate(target);
  if (!source) {
    throw new Error(`115- 创建“${labelText}”按钮失败：控制栏中没有模板按钮`);
  }

  const button = source.cloneNode(true) as HTMLButtonElement;
  const label = document.createElement('span');
  const children: HTMLElement[] = [];
  if (iconClass !== null) {
    const icon = document.createElement('i');
    icon.className = iconClass;
    children.push(icon);
  }
  label.textContent = labelText;
  children.push(label);
  button.replaceChildren(...children);
  button.disabled = false;
  button.removeAttribute('aria-expanded');
  button.removeAttribute('aria-haspopup');
  button.id = id;
  button.type = 'button';
  return button;
};

export const createOfflineButton = (target: HTMLElement): HTMLButtonElement => {
  const button = createToolbarButton(
    target,
    'minus115-offline',
    '离线下载',
    'icon-operate black ifo-linktask',
  );
  button.addEventListener('click', () => {
    void openOfficialOfflineDownload().catch((error: unknown) => {
      console.error('115- 打开官方离线下载弹窗失败', { error });
    });
  });
  return button;
};

const bindTransferAction = (
  button: HTMLButtonElement,
  app: StoragePageActions,
  labelText: string,
  action: () => Promise<number>,
): void => {
  const label = button.querySelector<HTMLSpanElement>(':scope > span');
  if (!label) {
    throw new Error(`115- 绑定“${labelText}”失败：按钮缺少文字节点`);
  }
  button.addEventListener('click', () => {
    if (button.disabled) {
      return;
    }
    button.disabled = true;
    label.textContent = '处理中…';
    void action()
      .then((count) => {
        app.showNotification('success', `${labelText} 已处理 ${count} 个文件`);
      })
      .catch((error: unknown) => {
        console.error(`115- ${labelText} 失败`, { error });
        app.showNotification('error', errorMessage(error));
      })
      .finally(() => {
        button.disabled = false;
        label.textContent = labelText;
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

const createDownloadDropdown = (
  template: HTMLButtonElement,
  app: StoragePageActions,
): HTMLDivElement => {
  const wrapper = document.createElement('div');
  wrapper.className = template.parentElement?.className || 'relative';

  const trigger = template.cloneNode(true) as HTMLButtonElement;
  trigger.id = 'minus115-download';
  trigger.type = 'button';
  trigger.disabled = false;
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
  let arrow = trigger.querySelector<HTMLImageElement>(':scope > img');
  if (!arrow) {
    arrow = document.createElement('img');
    arrow.alt = '';
    arrow.width = 12;
    arrow.height = 12;
    arrow.className = 'transition-transform';
    arrow.src = '/arrow_down_small.svg';
    trigger.append(arrow);
  }

  const getLinkButton = createMenuButton('minus115-get-link', '浏览器下载');
  getLinkButton.addEventListener('click', () => app.openFileDownload());
  const aria2Button = createMenuButton('minus115-aria2', '推送Aria2');
  bindTransferAction(aria2Button, app, '推送Aria2', () =>
    pushSelectedToAria2(getSelectedFiles(), {
      rpcUrl: settings.aria2RpcUrl,
      secret: settings.aria2Secret,
    }),
  );
  const idmButton = createMenuButton('minus115-idm', '推送IDM');
  bindTransferAction(idmButton, app, '推送IDM', () =>
    pushSelectedToIdm(getSelectedFiles(), { clientId: settings.idmClientId }),
  );

  const menuItems = document.createElement('div');
  menuItems.className = 'py-1';
  menuItems.append(getLinkButton, aria2Button, idmButton);
  const menuSurface = document.createElement('div');
  menuSurface.className = 'bg-white border border-gray-200 rounded-lg shadow-lg';
  menuSurface.append(menuItems);
  const menu = document.createElement('div');
  menu.className = 'absolute top-full left-0 pt-1 w-40 z-50';
  menu.hidden = true;
  menu.append(menuSurface);

  const setOpen = (open: boolean): void => {
    menu.hidden = !open;
    if (arrow instanceof HTMLImageElement) {
      arrow.classList.toggle('rotate-180', open);
    }
  };
  wrapper.addEventListener('mouseenter', () => setOpen(true));
  wrapper.addEventListener('mouseleave', () => setOpen(false));
  trigger.addEventListener('click', () => app.openFileDownload());
  menu.addEventListener('click', () => setOpen(false));
  wrapper.append(trigger, menu);
  return wrapper;
};

export const createSingleSelectionDownload = (
  target: HTMLElement,
  app: StoragePageActions,
): HTMLDivElement => {
  const uploadButton = findUploadButton(target);
  if (!uploadButton) {
    throw new Error('115- 创建单选直链下载按钮失败：未找到“上传”按钮');
  }
  return createDownloadDropdown(uploadButton, app);
};

export const createMultipleSelectionDownload = (
  target: HTMLElement,
  app: StoragePageActions,
): HTMLDivElement => {
  if (!(target instanceof HTMLButtonElement)) {
    throw new Error('115- 创建多选直链下载按钮失败：官方首个动作不是按钮');
  }
  return createDownloadDropdown(target, app);
};
