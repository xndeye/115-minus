export const observePage = (sync: () => void, signal: AbortSignal): (() => void) => {
  let frame: number | null = null;
  const schedule = (): void => {
    if (signal.aborted || frame !== null) {
      return;
    }
    frame = window.requestAnimationFrame(() => {
      frame = null;
      sync();
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  signal.addEventListener(
    'abort',
    () => {
      observer.disconnect();
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    },
    { once: true },
  );
  schedule();
  return schedule;
};
