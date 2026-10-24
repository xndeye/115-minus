import { ApplicationError } from '@/core/errors';
import { readStorageEntry, type StorageEntry } from '@/platform/115/storage-entry';

export const FILE_CHECKBOX_SELECTOR = '.file-list-wrap .checkbox-area input[type="checkbox"]';

interface ReactFiber {
  memoizedProps?: {
    file?: unknown;
  };
  return: ReactFiber | null;
}

const isFiber = (value: unknown): value is ReactFiber =>
  typeof value === 'object' && value !== null && 'return' in value;

const readPageFile = (checkbox: HTMLInputElement): StorageEntry => {
  const key = Object.keys(checkbox).find((item) => item.startsWith('__reactFiber$'));
  const value: unknown = key ? Reflect.get(checkbox, key) : undefined;
  let fiber = isFiber(value) ? value : undefined;
  while (fiber && !fiber.memoizedProps?.file) {
    fiber = fiber.return ?? undefined;
  }
  if (!fiber?.memoizedProps?.file) {
    throw new ApplicationError('读取文件信息', '115 页面组件结构已变化，无法获取文件信息');
  }
  return readStorageEntry(fiber.memoizedProps.file);
};

export const getSelectedFiles = (): StorageEntry[] =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>(`${FILE_CHECKBOX_SELECTOR}:checked`),
    readPageFile,
  );

export const findFileItemDownloadButton = (
  target: EventTarget | null,
): HTMLButtonElement | null => {
  const button =
    target instanceof Element
      ? target.closest<HTMLButtonElement>('.file-list-item [data-menu-action="download"] > button')
      : null;
  return button instanceof HTMLButtonElement ? button : null;
};

export const getFileFromListItem = (target: Element): StorageEntry => {
  const item = target.closest<HTMLElement>('.file-list-item[data-file-id]');
  if (!item) {
    throw new ApplicationError('读取列表项文件', '下载入口不在文件列表项中');
  }
  const checkbox = item.querySelector<HTMLInputElement>('.checkbox-area input[type="checkbox"]');
  if (!checkbox) {
    throw new ApplicationError('读取列表项文件', '列表项中不存在文件复选框');
  }
  return readPageFile(checkbox);
};

export const getSelectedFileCount = (): number =>
  document.querySelectorAll(`${FILE_CHECKBOX_SELECTOR}:checked`).length;
