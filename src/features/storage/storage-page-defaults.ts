const COLLAPSED_STORAGE_KEY = 'layout_collapsed_all_files';
const NEW_STORAGE_PAGE_PATH = '/storage/netdisk';

export const redirectLegacyStoragePage = (): boolean => {
  const isLegacyStoragePage =
    window.location.pathname === '/' &&
    new URLSearchParams(window.location.search).get('mode') === 'wangpan';
  if (!isLegacyStoragePage) {
    return false;
  }
  window.location.replace(NEW_STORAGE_PAGE_PATH);
  return true;
};

export const applyStoragePageDefaults = (): void => {
  window.localStorage.setItem(COLLAPSED_STORAGE_KEY, 'true');
};
