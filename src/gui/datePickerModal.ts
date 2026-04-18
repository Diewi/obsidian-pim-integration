import { App, Modal } from 'obsidian';

/**
 * Modal with a native date input field.
 * Resolves the promise with the selected Date on submit, or null on cancel.
 */
export class DatePickerModal extends Modal {
  private resolve: (value: Date | null) => void;
  private inputEl: HTMLInputElement;

  constructor(app: App, defaultDate: Date) {
    super(app);
    this.resolve = () => {};

    this.setTitle('Select a date');

    this.inputEl = this.contentEl.createEl('input', { type: 'date' });
    this.inputEl.value = defaultDate.toISOString().slice(0, 10);
    this.inputEl.style.width = '100%';

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.submit();
      }
    });

    const buttonContainer = this.contentEl.createDiv({ cls: 'modal-button-container' });
    buttonContainer
      .createEl('button', { text: 'Import', cls: 'mod-cta' })
      .addEventListener('click', () => this.submit());
    buttonContainer
      .createEl('button', { text: 'Cancel' })
      .addEventListener('click', () => this.close());
  }

  open(): Promise<Date | null> {
    return new Promise<Date | null>((resolve) => {
      this.resolve = resolve;
      super.open();
    });
  }

  onClose(): void {
    // Resolve with null if the modal was closed without submitting
    this.resolve(null);
  }

  private submit(): void {
    const value = this.inputEl.value;
    // Parse as local midnight — the caller uses getFullYear()/getMonth()/getDate()
    // (local-time accessors) to build day boundaries. Parsing as UTC would cause
    // an off-by-one error for users in negative UTC offsets.
    const [y, m, d] = value.split('-').map(Number);
    const parsed = new Date(y, m - 1, d);
    if (!isNaN(parsed.getTime())) {
      // Detach resolve so onClose doesn't fire null after a valid submit
      const res = this.resolve;
      this.resolve = () => {};
      this.close();
      res(parsed);
    }
  }
}
