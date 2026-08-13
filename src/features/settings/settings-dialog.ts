import { LitElement, css, html } from 'lit';
import { errorMessage } from '@/core/errors';
import { saveSettings, settings, type Settings } from '@/features/settings/settings-store';
import { featureStyles } from '@/ui/feature-styles';
import { notify } from '@/ui/notifications';
import '@/ui/components/minus-dialog';

export class SettingsDialog extends LitElement {
  static properties = {
    draft: { state: true },
    openState: { state: true },
  };

  static styles = [
    featureStyles,
    css`
      .settings {
        display: grid;
        gap: 12px;
      }

      h3 {
        margin: 0 0 4px;
        font-size: 15px;
      }

      label {
        display: grid;
        gap: 6px;
      }

      label span {
        color: var(--minus115-muted);
        font-size: 13px;
      }
    `,
  ];

  private draft: Settings = { ...settings };
  private openState = false;

  openDialog(): void {
    this.draft = { ...settings };
    this.openState = true;
  }

  private closeDialog(): void {
    this.openState = false;
  }

  private updateText(key: keyof Settings, value: string): void {
    this.draft = { ...this.draft, [key]: value };
  }

  private save(): void {
    try {
      saveSettings(this.draft);
      window.location.reload();
    } catch (error) {
      notify(this, 'error', errorMessage(error));
    }
  }

  protected render() {
    return html`
      <minus115-dialog
        .heading=${'115- 设置'}
        .open=${this.openState}
        @minus-close=${this.closeDialog}
      >
        <div class="settings">
          <h3>aria2</h3>
          <label>
            <span>JSON-RPC 地址</span>
            <input
              type="text"
              autocomplete="url"
              placeholder="http://127.0.0.1:6800/jsonrpc"
              .value=${this.draft.aria2RpcUrl}
              @input=${(event: Event) => {
                if (event.currentTarget instanceof HTMLInputElement) {
                  this.updateText('aria2RpcUrl', event.currentTarget.value.trim());
                }
              }}
            />
          </label>
          <label>
            <span>RPC 密钥（未设置时留空）</span>
            <input
              type="password"
              autocomplete="off"
              .value=${this.draft.aria2Secret}
              @input=${(event: Event) => {
                if (event.currentTarget instanceof HTMLInputElement) {
                  this.updateText('aria2Secret', event.currentTarget.value);
                }
              }}
            />
          </label>
          <h3>IDM</h3>
          <label>
            <span>IDM Integration Module 扩展本地存储中的 client 值</span>
            <input
              type="text"
              inputmode="numeric"
              autocomplete="off"
              placeholder="1"
              .value=${this.draft.idmClientId}
              @input=${(event: Event) => {
                if (event.currentTarget instanceof HTMLInputElement) {
                  this.updateText('idmClientId', event.currentTarget.value.trim());
                }
              }}
            />
          </label>
        </div>
        <div class="actions" slot="footer">
          <button type="button" @click=${this.closeDialog}>取消</button>
          <button class="primary" type="button" @click=${this.save}>保存并刷新</button>
        </div>
      </minus115-dialog>
    `;
  }
}

if (!customElements.get('minus115-settings-dialog')) {
  customElements.define('minus115-settings-dialog', SettingsDialog);
}

declare global {
  interface HTMLElementTagNameMap {
    'minus115-settings-dialog': SettingsDialog;
  }
}
