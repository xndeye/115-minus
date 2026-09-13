import { getDownloadLink } from '@/platform/115/download-api';

const startBrowserDownload = (url: string, name: string): void => {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => anchor.remove(), 100);
};

export const downloadFileInBrowser = async (pickCode: string): Promise<void> => {
  const link = await getDownloadLink(pickCode);
  startBrowserDownload(link.url, link.name);
};
