import {
  createOfflineButton,
  createSelectionDownload,
  createSettingsButton,
  setupFileItemDownload,
  type StoragePageActions,
} from '@/features/storage/storage-page-controls';
import { getSelectedFileCount } from '@/platform/115/storage-selection';
import { syncAside } from '@/platform/115/storage-sidebar';
import {
  findOfflineToolbarTarget,
  findSelectionDownloadTarget,
  findSettingsTarget,
} from '@/platform/115/storage-toolbar';

type ElementFactory = (target: HTMLElement) => HTMLElement;
type ElementInserter = (target: HTMLElement, element: HTMLElement) => void;
type ElementRemover = (element: HTMLElement) => void;
type TargetResolver = () => HTMLElement | null;

const FILE_CHECKBOX_SELECTOR = '.file-list-wrap .checkbox-area input[type="checkbox"]';
const PAGE_STRUCTURE_SELECTOR = [
  'aside',
  'button',
  '.file-list-wrap',
  '.sticky',
  '#minus115-settings',
  '#minus115-offline',
  '#minus115-download',
].join(',');

const stopPropagation = (event: MouseEvent): void => {
  event.stopPropagation();
};

class PersistentElement {
  private element: HTMLElement | null = null;

  constructor(
    private readonly createElement: ElementFactory,
    private readonly resolveTarget: TargetResolver,
    private readonly insertElement: ElementInserter,
    private readonly removeElement: ElementRemover,
  ) {}

  sync(enabled: boolean): void {
    if (!enabled) {
      if (this.element) {
        this.removeElement(this.element);
      }
      this.element = null;
      return;
    }
    const target = this.resolveTarget();
    if (!target) {
      if (this.element) {
        this.removeElement(this.element);
        this.element = null;
      }
      return;
    }
    if (
      this.element?.isConnected &&
      (target.contains(this.element) || this.element.contains(target))
    ) {
      return;
    }
    if (this.element) {
      this.removeElement(this.element);
    }
    this.element = this.createElement(target);
    this.element.addEventListener('mousedown', stopPropagation);
    this.insertElement(target, this.element);
  }
}

const appendElement: ElementInserter = (target, element) => {
  target.append(element);
};

const removeElement: ElementRemover = (element) => {
  element.remove();
};

interface HookedTarget {
  container: HTMLElement;
  overlay: HTMLElement;
  overflowHidden: boolean;
  toolbar: HTMLElement;
  zIndexRaised: boolean;
}

const hookedTargets = new WeakMap<HTMLElement, HookedTarget>();

const resolveSelectionDownloadTarget = (): HTMLButtonElement | null =>
  findSelectionDownloadTarget() ??
  document.querySelector<HTMLButtonElement>('#minus115-download');

const replaceSelectionDownload: ElementInserter = (target, element) => {
  const container = target.parentElement;
  if (!container) {
    throw new Error('115- 替换选中项下载按钮失败：官方按钮缺少容器');
  }
  const toolbar = container.parentElement;
  if (!toolbar) {
    throw new Error('115- 替换选中项下载按钮失败：官方操作栏不存在');
  }
  const overlay = toolbar.parentElement?.parentElement;
  if (!overlay) {
    throw new Error('115- 替换选中项下载按钮失败：官方选中项浮层不存在');
  }
  const overflowHidden = toolbar.classList.contains('overflow-hidden');
  const zIndexRaised = overlay.classList.contains('z-10');
  toolbar.classList.remove('overflow-hidden');
  if (zIndexRaised) {
    overlay.classList.replace('z-10', 'z-50');
  }
  container.replaceWith(element);
  hookedTargets.set(element, {
    container,
    overflowHidden,
    overlay,
    toolbar,
    zIndexRaised,
  });
};

const restoreSelectionDownload: ElementRemover = (element) => {
  const target = hookedTargets.get(element);
  if (target) {
    if (element.isConnected) {
      element.replaceWith(target.container);
    }
    if (target.overflowHidden && target.toolbar.isConnected) {
      target.toolbar.classList.add('overflow-hidden');
    }
    if (target.zIndexRaised && target.overlay.isConnected) {
      target.overlay.classList.replace('z-50', 'z-10');
    }
  }
  element.remove();
};

const containsPageStructure = (node: Node): boolean => {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(
    element?.matches(PAGE_STRUCTURE_SELECTOR) || element?.querySelector(PAGE_STRUCTURE_SELECTOR),
  );
};

const affectsPageStructure = (records: MutationRecord[]): boolean =>
  records.some((record) =>
    [...record.addedNodes, ...record.removedNodes].some(containsPageStructure),
  );

export const setupStoragePage = (app: StoragePageActions): void => {
  setupFileItemDownload(app);
  const mounts = [
    new PersistentElement(
      () => createSettingsButton(app),
      findSettingsTarget,
      appendElement,
      removeElement,
    ),
    new PersistentElement(
      createOfflineButton,
      findOfflineToolbarTarget,
      appendElement,
      removeElement,
    ),
  ];
  const selectionDownloadMount = new PersistentElement(
    (target) => createSelectionDownload(target, app),
    resolveSelectionDownloadTarget,
    replaceSelectionDownload,
    restoreSelectionDownload,
  );

  const sync = (): void => {
    try {
      syncAside();
      mounts.forEach((mount) => mount.sync(true));
      const selectedCount = getSelectedFileCount();
      selectionDownloadMount.sync(selectedCount > 0);
    } catch (error) {
      console.error('115- 同步页面功能失败', { error });
    }
  };

  let scheduled = false;
  const scheduleSync = (): void => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      sync();
    });
  };

  sync();
  const observer = new MutationObserver((records) => {
    if (affectsPageStructure(records)) {
      scheduleSync();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener(
    'change',
    (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.matches(FILE_CHECKBOX_SELECTOR)) {
        scheduleSync();
      }
    },
    true,
  );
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('aside nav a') : null;
    if (target) {
      window.setTimeout(scheduleSync, 0);
    }
  });
  window.addEventListener('popstate', scheduleSync);
};
