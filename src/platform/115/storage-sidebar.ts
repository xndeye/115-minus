import '@/platform/115/storage-sidebar.css';

interface AsideItem {
  href: string;
  icon: string;
  label: string;
}

const ASIDE_ITEMS: AsideItem[] = [
  {
    href: '/storage/allfiles?cid=0&mode=wangpan',
    icon: '/icons/sidebar_storage_gray.svg',
    label: '存储',
  },
  {
    href: '/storage/recentupload',
    icon: '/icons/storage/channel_recent_upload.svg',
    label: '最近上传',
  },
  {
    href: '/storage/clouddownload',
    icon: '/icons/storage/channel_cloud_download.svg',
    label: '云下载',
  },
  {
    href: '/storage/recyclebin',
    icon: '/icons/storage/channel_recycle_bin.svg',
    label: '回收站',
  },
];

const createAside = (): HTMLElement => {
  const nav = document.createElement('nav');
  nav.id = 'minus115-sidebar';
  nav.setAttribute('aria-label', '115- 导航');
  ASIDE_ITEMS.forEach((item) => {
    const link = document.createElement('a');
    link.href = item.href;
    const image = document.createElement('img');
    image.src = item.icon;
    image.alt = '';
    const label = document.createElement('span');
    label.textContent = item.label;
    link.append(image, label);
    nav.append(link);
  });
  return nav;
};

export const setupAside = (signal: AbortSignal): (() => void) => {
  let navigation: HTMLElement | null = null;
  signal.addEventListener('abort', () => navigation?.remove(), { once: true });
  return (): void => {
    if (!navigation?.isConnected) {
      const official = document.querySelector<HTMLElement>('aside nav:not(#minus115-sidebar)');
      if (!official) {
        return;
      }
      navigation ??= createAside();
      official.after(navigation);
    }

    const pathname = window.location.pathname;
    const shortcut = ASIDE_ITEMS.slice(1).find((item) => item.href === pathname);
    const activeHref =
      shortcut?.href ??
      (pathname === '/storage' || pathname.startsWith('/storage/')
        ? ASIDE_ITEMS[0]?.href
        : undefined);
    navigation.querySelectorAll<HTMLAnchorElement>('a').forEach((link) => {
      if (link.getAttribute('href') === activeHref) {
        link.setAttribute('aria-current', 'page');
      } else if (link.hasAttribute('aria-current')) {
        link.removeAttribute('aria-current');
      }
    });
  };
};
