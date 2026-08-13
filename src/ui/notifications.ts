export type NotificationKind = 'error' | 'info' | 'success';

export interface NotificationDetail {
  kind: NotificationKind;
  message: string;
}

export const notify = (target: EventTarget, kind: NotificationKind, message: string): void => {
  target.dispatchEvent(
    new CustomEvent<NotificationDetail>('minus115-notify', {
      bubbles: true,
      composed: true,
      detail: { kind, message },
    }),
  );
};
