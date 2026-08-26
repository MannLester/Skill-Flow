/** @jest-environment jsdom */

import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import BookServiceScreen from '@/app/services/[serviceId]/request';
import type { Service } from '@/data/fixtures';

const mockCreateBooking = jest.fn(() => ({ id: 'booking-web-1' }));
const mockService: Service = {
  id: 'logo',
  title: 'Logo Design',
  subtitle: 'Minimalist · Graphic Design',
  provider: 'Alex D.',
  providerId: 'student-alex',
  rating: 4.9,
  reviews: 32,
  price: 1500,
  category: 'Graphics & Design',
  description: 'A logo design service.',
  deliveryDays: 3,
  revisions: 'Unlimited',
  status: 'published',
  crop: { x: 765, y: 350, width: 90, height: 91 },
};

jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ serviceId: 'logo' }),
}));
jest.mock('@/context/session', () => ({
  useSession: () => ({ currentAccount: { id: 'client-mark', role: 'client' }, services: [mockService], createBooking: mockCreateBooking }),
}));

function getAccessibleElement(container: HTMLDivElement, role: string, label: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[role="${role}"][aria-label="${label}"]`);
  if (!element) throw new Error(`Missing ${role} named ${label}`);
  return element;
}

function getButtonByText(container: HTMLDivElement, label: string): HTMLElement {
  const element = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]')).find((candidate) => candidate.textContent?.trim() === label);
  if (!element) throw new Error(`Missing button with text ${label}`);
  return element;
}

function dispatchSeparatedKeyboard(target: HTMLElement, key: string) {
  act(() => target.focus());
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
  const keyupTarget = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
  act(() => keyupTarget.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true })));
}

function dispatchPointerClick(target: HTMLElement) {
  act(() => {
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('Book Service web accessibility', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<BookServiceScreen />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    mockCreateBooking.mockClear();
  });

  it('renders selector expansion and radio state in the real RNW DOM', () => {
    const trigger = getAccessibleElement(container, 'button', 'Delivery Time: 3 Days');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    act(() => trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(getAccessibleElement(container, 'button', 'Delivery Time: 3 Days').getAttribute('aria-expanded')).toBe('true');
    expect(getAccessibleElement(container, 'radio', '3 Days').getAttribute('aria-checked')).toBe('true');
    expect(getAccessibleElement(container, 'radio', '5 Days').getAttribute('aria-checked')).toBe('false');
  });

  it('handles separated keyboard events without swallowing the next pointer option', () => {
    let trigger = getAccessibleElement(container, 'button', 'Delivery Time: 3 Days');
    act(() => trigger.click());
    expect(getAccessibleElement(container, 'radio', '5 Days').getAttribute('aria-checked')).toBe('false');
    dispatchSeparatedKeyboard(getAccessibleElement(container, 'radio', '5 Days'), 'Enter');

    trigger = getAccessibleElement(container, 'button', 'Delivery Time: 5 Days');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);

    act(() => trigger.click());
    expect(getAccessibleElement(container, 'radio', '5 Days').getAttribute('aria-checked')).toBe('true');
    dispatchPointerClick(getAccessibleElement(container, 'radio', '7 Days'));

    trigger = getAccessibleElement(container, 'button', 'Delivery Time: 7 Days');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[role="radio"][aria-label="7 Days"]')).toBeNull();

    act(() => trigger.click());
    dispatchSeparatedKeyboard(getAccessibleElement(container, 'radio', '3 Days'), ' ');

    trigger = getAccessibleElement(container, 'button', 'Delivery Time: 3 Days');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on an outside pointer action or Escape without a redundant Close row', () => {
    let trigger = getAccessibleElement(container, 'button', 'Delivery Time: 3 Days');
    act(() => trigger.click());
    expect(container.textContent).not.toContain('Close');

    const description = container.querySelector<HTMLTextAreaElement>('textarea');
    if (!description) throw new Error('Missing project description input');
    act(() => description.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));

    trigger = getAccessibleElement(container, 'button', 'Delivery Time: 3 Days');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    act(() => trigger.click());
    dispatchSeparatedKeyboard(getAccessibleElement(container, 'radio', '5 Days'), 'Escape');

    trigger = getAccessibleElement(container, 'button', 'Delivery Time: 3 Days');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('passes keyboard-selected values through the web booking payload', () => {
    let trigger = getAccessibleElement(container, 'button', 'Delivery Time: 3 Days');
    act(() => trigger.click());
    dispatchSeparatedKeyboard(getAccessibleElement(container, 'radio', '5 Days'), ' ');

    trigger = getAccessibleElement(container, 'button', 'Budget: ₱1,500');
    act(() => trigger.click());
    dispatchSeparatedKeyboard(getAccessibleElement(container, 'radio', '₱2,000'), 'Enter');

    const description = container.querySelector<HTMLTextAreaElement>('textarea');
    if (!description) throw new Error('Missing project description input');
    const setNativeValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setNativeValue) throw new Error('Missing textarea value setter');
    act(() => {
      setNativeValue.call(description, 'A complete coffee shop logo request.');
      description.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => getButtonByText(container, 'Send Request').click());

    expect(mockCreateBooking).toHaveBeenCalledWith(expect.objectContaining({ deliveryDays: 5, budget: 2000, description: 'A complete coffee shop logo request.' }));
  });
});
