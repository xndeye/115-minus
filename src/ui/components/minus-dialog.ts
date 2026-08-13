import { LitElement, css, html, type PropertyValues } from 'lit';

export class MinusDialog extends LitElement {
  static properties = {
    closeDisabled: { attribute: 'close-disabled', type: Boolean },
    heading: { type: String },
    open: { type: Boolean },
    size: { type: String },
    hasFooter: { state: true },
  };

  static styles = css`
    :host {
      display: contents;
      font-family: var(--minus115-font);
    }

    dialog {
      width: min(640px, calc(100vw - 32px));
      max-height: calc(100vh - 32px);
      padding: 0;
      overflow: hidden;
      border: 1px solid var(--minus115-border);
      border-radius: 10px;
      color: var(--minus115-text);
      background: var(--minus115-surface);
      box-shadow: 0 16px 48px rgb(0 0 0 / 24%);
    }

    dialog.wide {
      width: min(1120px, calc(100vw - 32px));
    }

    dialog.narrow {
      width: min(420px, calc(100vw - 32px));
    }

    dialog::backdrop {
      background: rgb(0 0 0 / 45%);
      backdrop-filter: blur(1px);
    }

    article {
      display: flex;
      max-height: calc(100vh - 32px);
      flex-direction: column;
    }

    header,
    footer {
      display: flex;
      flex: none;
      align-items: center;
      padding: 14px 18px;
    }

    header {
      justify-content: space-between;
      border-bottom: 1px solid var(--minus115-border);
    }

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .close {
      width: 32px;
      height: 32px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      color: var(--minus115-muted);
      background: transparent;
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
    }

    .close:hover:not(:disabled) {
      color: var(--minus115-text);
      background: var(--minus115-hover);
    }

    .close:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }

    .body {
      min-height: 0;
      padding: 18px;
      overflow: auto;
    }

    footer {
      justify-content: flex-end;
      border-top: 1px solid var(--minus115-border);
    }

    footer[hidden] {
      display: none;
    }
  `;

  closeDisabled = false;
  heading = '';
  open = false;
  size: 'medium' | 'narrow' | 'wide' = 'medium';
  private hasFooter = false;

  protected updated(changed: PropertyValues<this>): void {
    if (!changed.has('open')) {
      return;
    }
    const dialog = this.renderRoot.querySelector('dialog');
    if (!(dialog instanceof HTMLDialogElement)) {
      return;
    }
    if (this.open && !dialog.open) {
      dialog.showModal();
    } else if (!this.open && dialog.open) {
      dialog.close();
    }
  }

  private requestClose(): void {
    if (!this.closeDisabled) {
      this.dispatchEvent(new CustomEvent('minus-close', { bubbles: true, composed: true }));
    }
  }

  private handleCancel(event: Event): void {
    event.preventDefault();
    this.requestClose();
  }

  private handleBackdropClick(event: MouseEvent): void {
    event.stopPropagation();
    if (!(event.target instanceof HTMLDialogElement)) {
      return;
    }
    const bounds = event.target.getBoundingClientRect();
    const inside =
      event.clientX >= bounds.left &&
      event.clientX <= bounds.right &&
      event.clientY >= bounds.top &&
      event.clientY <= bounds.bottom;
    if (!inside) {
      this.requestClose();
    }
  }

  private stopInteractionPropagation(event: Event): void {
    event.stopPropagation();
  }

  private handleFooterChange(event: Event): void {
    const slot = event.target;
    if (slot instanceof HTMLSlotElement) {
      this.hasFooter = slot.assignedElements().length > 0;
    }
  }

  protected render() {
    return html`
      <dialog
        class=${this.size}
        aria-labelledby="minus115-dialog-heading"
        @cancel=${this.handleCancel}
        @click=${this.handleBackdropClick}
        @contextmenu=${this.stopInteractionPropagation}
        @copy=${this.stopInteractionPropagation}
        @cut=${this.stopInteractionPropagation}
        @keydown=${this.stopInteractionPropagation}
        @keyup=${this.stopInteractionPropagation}
        @mousedown=${this.stopInteractionPropagation}
        @mouseup=${this.stopInteractionPropagation}
        @paste=${this.stopInteractionPropagation}
        @pointerdown=${this.stopInteractionPropagation}
        @pointerup=${this.stopInteractionPropagation}
        @wheel=${this.stopInteractionPropagation}
      >
        <article>
          <header>
            <h2 id="minus115-dialog-heading">${this.heading}</h2>
            <button
              class="close"
              type="button"
              aria-label="关闭"
              ?disabled=${this.closeDisabled}
              @click=${this.requestClose}
            >
              ×
            </button>
          </header>
          <div class="body"><slot></slot></div>
          <footer ?hidden=${!this.hasFooter}>
            <slot name="footer" @slotchange=${this.handleFooterChange}></slot>
          </footer>
        </article>
      </dialog>
    `;
  }
}

if (!customElements.get('minus115-dialog')) {
  customElements.define('minus115-dialog', MinusDialog);
}

declare global {
  interface HTMLElementTagNameMap {
    'minus115-dialog': MinusDialog;
  }
}
