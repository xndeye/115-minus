import { LitElement, css, html } from 'lit';
import type { FileDownloadDialog } from '@/features/download/file-download-dialog';
import type { SettingsDialog } from '@/features/settings/settings-dialog';
import type { NotificationKind } from '@/ui/notifications';
import type { StorageEntry } from '@/platform/115/storage-entry';
import '@/features/download/file-download-dialog';
import '@/features/settings/settings-dialog';

interface Toast {
  id: number;
  kind: NotificationKind;
  message: string;
}

export class Minus115App extends LitElement {
  static properties = {
    toasts: { state: true },
  };

  static styles = css`
    :host {
      --minus115-primary: #2777f8;
      --minus115-danger: #d03050;
      --minus115-text: #20252b;
      --minus115-muted: #6f7782;
      --minus115-border: #e2e5e9;
      --minus115-surface: #fff;
      --minus115-hover: #f3f5f7;
      --minus115-font: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: contents;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --minus115-text: #e5e7eb;
        --minus115-muted: #a8adb5;
        --minus115-border: #3d424a;
        --minus115-surface: #202328;
        --minus115-hover: #30343b;
      }
    }

    .toasts {
      position: fixed;
      z-index: 2147483647;
      top: 20px;
      left: 50%;
      display: grid;
      width: min(440px, calc(100vw - 32px));
      gap: 10px;
      pointer-events: none;
      transform: translateX(-50%);
    }

    .toast {
      padding: 11px 14px;
      border: 1px solid var(--minus115-border);
      border-radius: 7px;
      color: var(--minus115-text);
      background: var(--minus115-surface);
      box-shadow: 0 8px 28px rgb(0 0 0 / 20%);
      font-family: var(--minus115-font);
      line-height: 1.45;
      pointer-events: auto;
    }

    .toast.success {
      border-left: 4px solid #18a058;
    }

    .toast.error {
      border-left: 4px solid var(--minus115-danger);
    }

    .toast.info {
      border-left: 4px solid var(--minus115-primary);
    }
  `;

  private nextToastId = 1;
  private toasts: Toast[] = [];
  private readonly toastTimers = new Set<number>();

  disconnectedCallback(): void {
    this.toastTimers.forEach((timer) => window.clearTimeout(timer));
    this.toastTimers.clear();
    super.disconnectedCallback();
  }

  openFileDownload(selected: readonly StorageEntry[]): void {
    this.getFeature('minus115-file-download').openDialog(selected);
  }

  openSettings(): void {
    this.getFeature('minus115-settings-dialog').openDialog();
  }

  showNotification(kind: NotificationKind, message: string): void {
    const toast: Toast = {
      id: this.nextToastId,
      kind,
      message,
    };
    this.nextToastId += 1;
    this.toasts = [...this.toasts, toast];
    const timer = window.setTimeout(
      () => {
        this.toastTimers.delete(timer);
        this.toasts = this.toasts.filter((item) => item.id !== toast.id);
      },
      kind === 'error' ? 6_000 : 3_000,
    );
    this.toastTimers.add(timer);
  }

  private getFeature(selector: 'minus115-file-download'): FileDownloadDialog;
  private getFeature(selector: 'minus115-settings-dialog'): SettingsDialog;
  private getFeature(selector: string) {
    const feature = this.renderRoot.querySelector(selector);
    if (!feature) {
      throw new Error(`115- UI 组件尚未挂载：${selector}`);
    }
    return feature;
  }

  protected render() {
    return html`
      <minus115-file-download></minus115-file-download>
      <minus115-settings-dialog></minus115-settings-dialog>
      <div class="toasts" aria-live="polite" aria-atomic="true">
        ${this.toasts.map(
          (toast) => html`<div class="toast ${toast.kind}" role="status">${toast.message}</div>`,
        )}
      </div>
    `;
  }
}

if (!customElements.get('minus115-app')) {
  customElements.define('minus115-app', Minus115App);
}

declare global {
  interface HTMLElementTagNameMap {
    'minus115-app': Minus115App;
  }
}
