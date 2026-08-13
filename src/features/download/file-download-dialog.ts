import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { errorMessage } from '@/core/errors';
import { getDownloadLink, listFolder } from '@/platform/115/download-api';
import { getSelectedFiles } from '@/platform/115/storage-selection';
import type { StorageEntry } from '@/platform/115/storage-entry';
import { featureStyles } from '@/ui/feature-styles';
import { notify } from '@/ui/notifications';
import '@/ui/components/minus-dialog';

interface DownloadNode extends StorageEntry {
  children?: DownloadNode[];
}

const createNode = (entry: StorageEntry): DownloadNode => ({ ...entry });

const startBrowserDownload = (url: string, name: string): void => {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => anchor.remove(), 100);
};

const replaceChildren = (
  nodes: DownloadNode[],
  pickCode: string,
  children: DownloadNode[],
): DownloadNode[] =>
  nodes.map((node) => {
    if (node.pickCode === pickCode) {
      return { ...node, children };
    }
    return node.children
      ? { ...node, children: replaceChildren(node.children, pickCode, children) }
      : node;
  });

export class FileDownloadDialog extends LitElement {
  static properties = {
    downloadingCodes: { state: true },
    loadingDirectories: { state: true },
    nodes: { state: true },
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
  private activeDirectoryRequests = 0;
  private readonly directoryWaiters: Array<() => void> = [];
  private loadingDirectories: string[] = [];
  private nodes: DownloadNode[] = [];
  private openState = false;
  private sessionId = 0;

  openDialog(): void {
    try {
      const selected = getSelectedFiles();
      if (selected.length === 0) {
        throw new Error('请选择文件');
      }
      this.sessionId += 1;
      this.loadingDirectories = [];
      this.nodes = selected.map(createNode);
      this.openState = true;
    } catch (error) {
      notify(this, 'error', errorMessage(error));
    }
  }

  private closeDialog(): void {
    this.sessionId += 1;
    this.openState = false;
  }

  private async listDirectory(directoryId: string): Promise<StorageEntry[]> {
    if (this.activeDirectoryRequests >= 4) {
      await new Promise<void>((resolve) => this.directoryWaiters.push(resolve));
    }
    this.activeDirectoryRequests += 1;
    try {
      return await listFolder(directoryId);
    } finally {
      this.activeDirectoryRequests -= 1;
      this.directoryWaiters.shift()?.();
    }
  }

  private async loadDirectory(node: DownloadNode): Promise<void> {
    if (
      !node.isDirectory ||
      node.children !== undefined ||
      this.loadingDirectories.includes(node.pickCode)
    ) {
      return;
    }
    const currentSessionId = this.sessionId;
    this.loadingDirectories = [...this.loadingDirectories, node.pickCode];
    try {
      const children = (await this.listDirectory(node.directoryId)).map(createNode);
      if (currentSessionId !== this.sessionId) {
        return;
      }
      this.nodes = replaceChildren(this.nodes, node.pickCode, children);
    } catch (error) {
      if (currentSessionId === this.sessionId) {
        notify(this, 'error', errorMessage(error));
      }
      throw error;
    } finally {
      if (currentSessionId === this.sessionId) {
        this.loadingDirectories = this.loadingDirectories.filter((code) => code !== node.pickCode);
      }
    }
  }

  private handleToggle(event: Event, node: DownloadNode): void {
    const details = event.currentTarget;
    if (details instanceof HTMLDetailsElement && details.open) {
      void this.loadDirectory(node).catch(() => {
        details.open = false;
      });
    }
  }

  private async download(node: DownloadNode): Promise<void> {
    if (this.downloadingCodes.includes(node.pickCode)) {
      return;
    }
    this.downloadingCodes = [...this.downloadingCodes, node.pickCode];
    try {
      const link = await getDownloadLink(node.pickCode);
      startBrowserDownload(link.url, link.name);
    } catch (error) {
      notify(this, 'error', errorMessage(error));
    } finally {
      this.downloadingCodes = this.downloadingCodes.filter((code) => code !== node.pickCode);
    }
  }

  private renderNodes(nodes: DownloadNode[]): TemplateResult {
    return html`
      <ul>
        ${nodes.map((node) =>
          node.isDirectory
            ? html`
                <li>
                  <details @toggle=${(event: Event) => this.handleToggle(event, node)}>
                    <summary>
                      ${node.name}
                      ${this.loadingDirectories.includes(node.pickCode)
                        ? html`<span class="folder-status">读取中…</span>`
                        : nothing}
                    </summary>
                    ${node.children === undefined
                      ? nothing
                      : node.children.length === 0
                        ? html`<p class="empty">空文件夹</p>`
                        : this.renderNodes(node.children)}
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
        @minus-close=${this.closeDialog}
      >
        <div class="tree-root">${this.renderNodes(this.nodes)}</div>
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
