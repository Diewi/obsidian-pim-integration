/**
 * Generic input validator that attaches to an HTMLInputElement and shows
 * a small hint below the input when validation fails.
 *
 * Usage:
 *   new InputValidator(inputEl, (value) => {
 *     if (isInvalid(value)) return 'Error message';
 *     return null; // valid
 *   });
 */
export class InputValidator {
  private inputEl: HTMLInputElement;
  private hintEl: HTMLElement;
  private validate: (value: string) => string | null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly DEBOUNCE_MS = 300;

  constructor(inputEl: HTMLInputElement, validate: (value: string) => string | null) {
    this.inputEl = inputEl;
    this.validate = validate;

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'pim-input-validation-hint';
    this.hintEl.style.cssText =
      'color: var(--text-error); font-size: 0.75em; padding: 4px 0 0 0; display: none;';

    // Place hint after the closest .setting-item so it appears below the full row.
    // Falls back to inserting after the input itself.
    const settingItem = this.inputEl.closest('.setting-item');
    if (settingItem) {
      settingItem.insertAdjacentElement('afterend', this.hintEl);
    } else {
      this.inputEl.insertAdjacentElement('afterend', this.hintEl);
    }

    this.inputEl.addEventListener('input', () => this.onInput());

    // Run initial validation
    this.runValidation(this.inputEl.value);
  }

  private onInput(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.runValidation(this.inputEl.value);
    }, InputValidator.DEBOUNCE_MS);
  }

  private runValidation(value: string): void {
    const error = this.validate(value);
    if (error) {
      this.hintEl.textContent = error;
      this.hintEl.style.display = 'block';
    } else {
      this.hintEl.textContent = '';
      this.hintEl.style.display = 'none';
    }
  }
}
