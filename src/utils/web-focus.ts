/**
 * Release focus before React Navigation hides the previous screen on web.
 *
 * Native platforms do not expose `document`, so this is intentionally a
 * no-op outside a browser. Keeping the platform check here lets navigation
 * screens use one transition listener without changing Android behavior.
 */
export function blurActiveWebElement(): void {
  if (typeof document === 'undefined') return;

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && activeElement !== document.body) {
    activeElement.blur();
  }
}
