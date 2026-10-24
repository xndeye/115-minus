import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { errorMessage } from '@/core/errors';
import { downloadFileInBrowser } from '@/features/download/browser-download';
import { listFolder } from '@/platform/115/download-api';
import type { StorageEntry, StorageDirectory, StorageFile } from '@/platform/115/storage-entry';
import { featureStyles } from '@/ui/feature-styles';
import '@/ui/components/minus-dialog';

export class FileDownloadDialog extends LitElement {
  static properties = {
    downloadingCodes: { state: true },
    errorText: { state: true },
    loadingDirectories: { state: true },
    nodes: { state: true },
    directoryEntries: { state: true },
    openState: { state: true },
  };

  static styles = [
    featureStyles,
    css`
      ul {
        margin: 0;
        padding-left: 22px;
        list-style: none;
      }

      .tree-root {
        max-height: 55vh;
        padding-left: 0;
        overflow: auto;
      }

      li {
        margin: 3px 0;
      }

      summary {
        padding: 5px 4px;
        border-radius: 4px;
        cursor: pointer;
        user-select: none;
      }

      summary:hover {
        background: var(--minus115-hover);
      }

      .file {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 4px 4px 4px 20px;
      }

      .file-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .folder-status {
        margin-left: 8px;
        color: var(--minus115-muted);
        font-size: 12px;
      }
    `,
  ];

  private downloadingCodes: string[] = [];
  private errorText = '';
  private activeDirectoryRequests = 0;
  private readonly directoryWaiters: Array<() => void> = [];
  private loadingDirectories: string[] = [];
  private nodes: readonly StorageEntry[] = [];
  private directoryEntries = new Map<string, StorageEntry[]>();
  private openState = false;
  private controller = new AbortController();

  openDialog(selected: readonly StorageEntry[]): void {
    this.controller.abort();
    this.controller = new AbortController();
    this.errorText = '';
    this.loadingDirectories = [];
    this.downloadingCodes = [];
    this.directoryEntries = new Map();
    this.nodes = selected;
    this.openState = true;
  }

  disconnectedCallback(): void {
    this.controller.abort();
    super.disconnectedCallback();
  }

  private closeDialog(): void {
    this.controller.abort();
    this.openState = false;
  }

  private async listDirectory(directoryId: string, signal: AbortSignal): Promise<StorageEntry[]> {
    if (this.activeDirectoryRequests >= 4) {
      await new Promise<void>((resolve) => this.directoryWaiters.push(resolve));
    } else {
      this.activeDirectoryRequests += 1;
    }
    try {
      signal.throwIfAborted();
      return await listFolder(directoryId, signal);
    } finally {
      const next = this.directoryWaiters.shift();
      if (next) next();
      else this.activeDirectoryRequests -= 1;
    }
  }

  private async loadDirectory(event: Event, node: StorageDirectory): Promise<void> {
    const details = event.currentTarget as HTMLDetailsElement;
    if (
      !details.isConnected ||
      !details.open ||
      this.directoryEntries.has(node.id) ||
      this.loadingDirectories.includes(node.id)
    ) {
      return;
    }
    const { signal } = this.controller;
    this.errorText = '';
    this.loadingDirectories = [...this.loadingDirectories, node.id];
    try {
      const children = await this.listDirectory(node.id, signal);
      signal.throwIfAborted();
      this.directoryEntries = new Map(this.directoryEntries).set(node.id, children);
    } catch (error) {
      if (!signal.aborted) {
        this.errorText = errorMessage(error);
        console.error('115- 读取文件夹失败', { directoryId: node.id, error });
        details.open = false;
      }
    } finally {
      if (!signal.aborted) {
        this.loadingDirectories = this.loadingDirectories.filter((id) => id !== node.id);
      }
    }
  }

  private async download(node: StorageFile): Promise<void> {
    if (this.downloadingCodes.includes(node.pickCode)) {
      return;
    }
    this.downloadingCodes = [...this.downloadingCodes, node.pickCode];
    this.errorText = '';
    const { signal } = this.controller;
    try {
      await downloadFileInBrowser(node.pickCode, signal);
    } catch (error) {
      if (!signal.aborted) {
        this.errorText = errorMessage(error);
        console.error('115- 浏览器下载失败', { pickCode: node.pickCode, error });
      }
    } finally {
      if (!signal.aborted) {
        this.downloadingCodes = this.downloadingCodes.filter((code) => code !== node.pickCode);
      }
    }
  }

  private renderNodes(nodes: readonly StorageEntry[]): TemplateResult {
    return html`
      <ul>
        ${nodes.map((node) =>
          node.isDirectory
            ? html`
                <li>
                  <details @toggle=${(event: Event) => void this.loadDirectory(event, node)}>
                    <summary>
                      ${node.name}
                      ${this.loadingDirectories.includes(node.id)
                        ? html`<span class="folder-status">读取中…</span>`
                        : nothing}
                    </summary>
                    ${!this.directoryEntries.has(node.id)
                      ? nothing
                      : this.directoryEntries.get(node.id)?.length === 0
                        ? html`<p class="empty">空文件夹</p>`
                        : this.renderNodes(this.directoryEntries.get(node.id)!)}
                  </details>
                </li>
              `
            : html`
                <li class="file">
                  <span class="file-name" title=${node.name}>${node.name}</span>
                  <button
                    class="link"
                    type="button"
                    ?disabled=${this.downloadingCodes.includes(node.pickCode)}
                    @click=${() => void this.download(node)}
                  >
                    ${this.downloadingCodes.includes(node.pickCode) ? '获取中…' : '下载'}
                  </button>
                </li>
              `,
        )}
      </ul>
    `;
  }

  protected render() {
    return html`
      <minus115-dialog
        .heading=${'文件下载'}
        .open=${this.openState}
        .errorMessage=${this.errorText}
        @minus-close=${this.closeDialog}
      >
        <div class="tree-root">${keyed(this.controller, this.renderNodes(this.nodes))}</div>
      </minus115-dialog>
    `;
  }
}

if (!customElements.get('minus115-file-download')) {
  customElements.define('minus115-file-download', FileDownloadDialog);
}

declare global {
  interface HTMLElementTagNameMap {
    'minus115-file-download': FileDownloadDialog;
  }
}
