'use client';

/**
 * Copy text to clipboard. Tries the modern Clipboard API first, then
 * falls back to the deprecated `execCommand('copy')` path for browsers
 * or contexts where the modern API is blocked. Returns `true` on
 * success, `false` otherwise — never throws.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    let textarea: HTMLTextAreaElement | null = null;
    try {
      textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position: fixed; opacity: 0; pointer-events: none; left: -9999px;';
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      if (textarea?.parentNode) {
        document.body.removeChild(textarea);
      }
    }
  }
}
