/** @jest-environment jsdom */

import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import BookServiceScreen from '@/app/services/[serviceId]/request';

const mockCreateBooking = jest.fn(() => ({ id: 'booking-web-1' }));
const mockService = {
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
  status: 'published' as const,
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

  it('supports keyboard selection and closes the list after choosing a value', () => {
    const trigger = getAccessibleElement(container, 'button', 'Delivery Time: 3 Days');
    // RNW renders a role=button Pressable as a native button; a browser turns
    // Enter/Space on that focusable element into the click tested here.
    act(() => trigger.click());
    const option = getAccessibleElement(container, 'radio', '5 Days');
    act(() => {
      option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      option.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    });

    expect(getAccessibleElement(container, 'button', 'Delivery Time: 5 Days').getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[role="radio"][aria-label="5 Days"]')).toBeNull();
  });
});
