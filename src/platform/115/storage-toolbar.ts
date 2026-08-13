import { ApplicationError } from '@/core/errors';

const findButton = (root: ParentNode, text: string): HTMLButtonElement | null =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === text,
  ) ?? null;

export const findUploadButton = (root: ParentNode): HTMLButtonElement | null => {
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

const waitForButton = (text: string, timeoutMs: number): Promise<HTMLButtonElement> =>
  new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const button = findButton(document, text);
      if (button) {
        observer.disconnect();
        window.clearTimeout(timeoutId);
        resolve(button);
      }
    });
    const timeoutId = window.setTimeout(() => {
      observer.disconnect();
      reject(new ApplicationError('打开离线下载', `等待官方“${text}”入口超时`));
    }, timeoutMs);
    observer.observe(document.body, { childList: true, subtree: true });

    const button = findButton(document, text);
    if (button) {
      observer.disconnect();
      window.clearTimeout(timeoutId);
      resolve(button);
    }
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
  const button = selectionOverlay?.querySelector('button');
  return button instanceof HTMLButtonElement ? button : null;
};

export const openOfficialOfflineDownload = async (): Promise<void> => {
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
  const menuButton = await waitForButton('添加云下载', 1_000);
  menuButton.click();
};

export const findSettingsTarget = (): HTMLElement | null =>
  findButton(document, '帮助')?.parentElement ?? null;
