import { ApplicationError } from '@/core/errors';

interface AsideReplacement {
  icon: string;
  label: string;
  sourceHref: string;
  targetHref: string;
}

interface AsideAppearance {
  imageClassNames: string[];
  labelClassName: string;
  linkClassName: string;
  style: string | null;
}

const ASIDE_REPLACEMENTS: AsideReplacement[] = [
  {
    sourceHref: '/social/jianghu',
    targetHref: '/storage/recentupload',
    label: '最近上传',
    icon: '/icons/storage/channel_recent_upload.svg',
  },
  {
    sourceHref: '/chat',
    targetHref: '/storage/clouddownload',
    label: '云下载',
    icon: '/icons/storage/channel_cloud_download.svg',
  },
  {
    sourceHref: '/life/mine/vip',
    targetHref: '/storage/recyclebin',
    label: '回收站',
    icon: '/icons/storage/channel_recycle_bin.svg',
  },
];

const replaceAsideItem = (item: AsideReplacement): void => {
  const source = document.querySelector<HTMLAnchorElement>(
    `aside nav a[href="${item.sourceHref}"]`,
  );
  if (!source) {
    return;
  }
  const replacement = source.cloneNode(true) as HTMLAnchorElement;
  replacement.href = item.targetHref;
  replacement.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    image.alt = item.label;
    image.src = item.icon;
  });
  const labels = Array.from(replacement.children).filter(
    (child): child is HTMLSpanElement => child instanceof HTMLSpanElement,
  );
  const label = labels.shift();
  if (!label) {
    throw new ApplicationError('更新侧边栏', `入口“${item.label}”缺少文字节点`);
  }
  label.textContent = item.label;
  labels.forEach((extra) => extra.remove());
  source.replaceWith(replacement);
};

const readAsideAppearance = (link: HTMLAnchorElement): AsideAppearance => {
  const label = link.querySelector<HTMLSpanElement>(':scope > span');
  const images = Array.from(link.querySelectorAll<HTMLImageElement>(':scope > img'));
  if (!label || images.length === 0) {
    throw new ApplicationError('更新侧边栏选中状态', '官方菜单项结构不完整');
  }
  return {
    imageClassNames: images.map((image) => image.className),
    labelClassName: label.className,
    linkClassName: link.className,
    style: link.getAttribute('style'),
  };
};

const applyAsideAppearance = (link: HTMLAnchorElement, appearance: AsideAppearance): void => {
  const label = link.querySelector<HTMLSpanElement>(':scope > span');
  const images = Array.from(link.querySelectorAll<HTMLImageElement>(':scope > img'));
  if (!label || images.length !== appearance.imageClassNames.length) {
    throw new ApplicationError('更新侧边栏选中状态', '菜单项与官方模板结构不一致');
  }
  link.className = appearance.linkClassName;
  if (appearance.style === null) {
    link.removeAttribute('style');
  } else {
    link.setAttribute('style', appearance.style);
  }
  label.className = appearance.labelClassName;
  images.forEach((image, index) => {
    const className = appearance.imageClassNames[index];
    if (className === undefined) {
      throw new ApplicationError('更新侧边栏选中状态', '官方图标状态缺失');
    }
    image.className = className;
  });
};

const syncAsideSelection = (): void => {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('aside nav a'));
  const activeTemplate = links.find(
    (link) => link.classList.contains('bg-white') && link.classList.contains('text-blue-600'),
  );
  const inactiveTemplate = links.find((link) => link.classList.contains('text-[#6F8396]'));
  if (!activeTemplate || !inactiveTemplate) {
    return;
  }
  const activeAppearance = readAsideAppearance(activeTemplate);
  const inactiveAppearance = readAsideAppearance(inactiveTemplate);
  links.forEach((link) => {
    const appearance =
      new URL(link.href).pathname === window.location.pathname
        ? activeAppearance
        : inactiveAppearance;
    applyAsideAppearance(link, appearance);
  });
};

export const syncAside = (): void => {
  ASIDE_REPLACEMENTS.forEach(replaceAsideItem);
  syncAsideSelection();
};
