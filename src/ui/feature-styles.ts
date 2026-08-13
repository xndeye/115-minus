import { css } from 'lit';

export const featureStyles = css`
  :host {
    color: var(--minus115-text);
    font-family: var(--minus115-font);
  }

  button,
  input,
  textarea {
    box-sizing: border-box;
    font: inherit;
  }

  button {
    min-height: 32px;
    padding: 5px 14px;
    border: 1px solid var(--minus115-border);
    border-radius: 6px;
    color: var(--minus115-text);
    background: var(--minus115-surface);
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    border-color: var(--minus115-primary);
    color: var(--minus115-primary);
  }

  button.primary {
    border-color: var(--minus115-primary);
    color: #fff;
    background: var(--minus115-primary);
  }

  button.danger {
    color: var(--minus115-danger);
  }

  button.link {
    min-height: auto;
    padding: 2px 4px;
    border: 0;
    color: var(--minus115-primary);
    background: transparent;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  input[type='text'],
  input[type='password'],
  textarea {
    width: 100%;
    border: 1px solid var(--minus115-border);
    border-radius: 6px;
    color: var(--minus115-text);
    background: var(--minus115-surface);
    outline: none;
  }

  input[type='text'],
  input[type='password'] {
    height: 34px;
    padding: 0 10px;
  }

  textarea {
    min-height: 210px;
    padding: 10px;
    resize: vertical;
  }

  input:focus,
  textarea:focus {
    border-color: var(--minus115-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--minus115-primary) 18%, transparent);
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }

  .empty,
  .muted {
    color: var(--minus115-muted);
  }

  .loading {
    display: flex;
    min-height: 100px;
    align-items: center;
    justify-content: center;
    color: var(--minus115-muted);
  }
`;
