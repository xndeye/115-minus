import { ApplicationError } from '@/core/errors';

const findButton = (root: ParentNode, text: string): HTMLButtonElement | null =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === text,
  ) ?? null;

const findUploadButton = (root: ParentNode): HTMLButtonElement | null => {
  const inputs = root.querySelectorAll<HTMLInputElement>(
    'input[type="file"][multiple]:not([webkitdirectory])',
  );
  for (const input of inputs) {
    const container = input.parentElement;
    const directoryInput = container?.querySelector(':scope > input[type="file"][webkitdirectory]');
    const button = container?.querySelector(':scope > button');
    if (directoryInput && button instanceof HTMLButtonElement) {
      return button;
    }
  }
  return null;
};

const waitForButton = (
  text: string,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<HTMLButtonElement> =>
  new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const cleanup = (): void => {
      observer.disconnect();
      window.clearTimeout(timeoutId);
      signal.removeEventListener('abort', abort);
    };
    const check = (): void => {
      const button = findButton(document, text);
      if (button) {
        cleanup();
        resolve(button);
      }
    };
    const abort = (): void => {
      cleanup();
      reject(signal.reason);
    };
    const observer = new MutationObserver(check);
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new ApplicationError('打开离线下载', `等待官方“${text}”入口超时`));
    }, timeoutMs);
    observer.observe(document.body, { childList: true, subtree: true });
    signal.addEventListener('abort', abort, { once: true });
    check();
  });

export const findOfflineToolbarTarget = (): HTMLElement | null => {
  const uploadButton = findUploadButton(document);
  const actions = uploadButton?.parentElement?.parentElement;
  return actions instanceof HTMLElement ? actions : null;
};

export const findSelectionDownloadTarget = (): HTMLButtonElement | null => {
  const fileList = document.querySelector<HTMLElement>('.file-list-wrap');
  const sticky = fileList?.closest<HTMLElement>('.sticky');
  const selectionOverlay = sticky?.querySelector<HTMLElement>('.absolute.top-0.left-0.right-0');
  return selectionOverlay ? findButton(selectionOverlay, '下载') : null;
};

export const mountDownloadMenu = (button: HTMLButtonElement, menu: HTMLElement): (() => void) => {
  const container = button.parentElement;
  const toolbar = container?.parentElement;
  const overlay = toolbar?.parentElement?.parentElement;
  if (!container || !toolbar || !overlay) {
    throw new ApplicationError('挂载直链下载菜单', '原站下载按钮缺少控制栏容器');
  }
  const display = container.style.display;
  const priority = container.style.getPropertyPriority('display');
  const clipped = toolbar.classList.contains('overflow-hidden');
  const raised = overlay.classList.contains('z-10');
  // 保留 React 管理的节点，只隐藏原入口并插入脚本菜单。
  container.style.setProperty('display', 'none', 'important');
  toolbar.classList.remove('overflow-hidden');
  if (raised) overlay.classList.replace('z-10', 'z-50');
  container.after(menu);
  return () => {
    menu.remove();
    container.style.setProperty('display', display, priority);
    if (clipped) toolbar.classList.add('overflow-hidden');
    if (raised) overlay.classList.replace('z-50', 'z-10');
  };
};

export const openOfficialOfflineDownload = async (signal: AbortSignal): Promise<void> => {
  signal.throwIfAborted();
  const uploadButton = findUploadButton(document);
  if (!uploadButton) {
    throw new ApplicationError('打开离线下载', '未找到主页面“上传”按钮');
  }

  uploadButton.dispatchEvent(
    new MouseEvent('mouseover', {
      bubbles: true,
      cancelable: true,
    }),
  );
  const menuButton = await waitForButton('添加云下载', 1_000, signal);
  signal.throwIfAborted();
  menuButton.click();
};

export const findSettingsTarget = (): HTMLElement | null =>
  findButton(document, '帮助')?.parentElement ?? null;
