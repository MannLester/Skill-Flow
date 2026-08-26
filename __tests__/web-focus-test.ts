/** @jest-environment jsdom */

import { blurActiveWebElement } from '@/utils/web-focus';

describe('web navigation focus guard', () => {
  it('blurs a focused element before its screen can be hidden', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    expect(document.activeElement).toBe(input);
    blurActiveWebElement();
    expect(document.activeElement).toBe(document.body);

    input.remove();
  });

  it('does not change body focus when no child is focused', () => {
    document.body.focus();

    expect(() => blurActiveWebElement()).not.toThrow();
    expect(document.activeElement).toBe(document.body);
  });
});
