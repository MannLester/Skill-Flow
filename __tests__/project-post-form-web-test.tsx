/** @jest-environment jsdom */

import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import { ProjectPostForm } from '@/components/project-post-form';

const mockReplace = jest.fn();
const mockSaveProjectPost = jest.fn((input: { title: string; description: string; skills: string[] }, publish: boolean) => {
  if (!input.title.trim() || !input.description.trim() || !input.skills.some((skill) => skill.trim())) {
    return { ok: false, message: 'Complete every project field with valid values.' };
  }
  return { ok: true, projectPost: { id: publish ? 'post-open' : 'post-draft' } };
});

jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('expo-router', () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }));
jest.mock('@/context/session', () => ({
  useSession: () => ({
    currentAccount: { id: 'client-mark', role: 'client' }, projectPosts: [],
    saveProjectPost: (...args: Parameters<typeof mockSaveProjectPost>) => mockSaveProjectPost(...args),
    setProjectPostStatus: jest.fn(),
  }),
}));

function getButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]')).find((element) => element.textContent?.trim() === label);
  if (!button) throw new Error(`Missing button ${label}`);
  return button;
}

function getInput(container: HTMLElement, label: string) {
  const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`);
  if (!input) throw new Error(`Missing input ${label}`);
  return input;
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (!setter) throw new Error('Missing input value setter');
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function dispatchSeparatedKeyboard(target: HTMLElement, key: string) {
  act(() => target.focus());
  act(() => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
  const keyupTarget = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
  act(() => {
    keyupTarget.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    target.click();
  });
}

function dispatchPointerClick(target: HTMLElement) {
  act(() => {
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('Client project-post validation in the real React Native Web DOM', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ProjectPostForm />));
    mockReplace.mockClear();
    mockSaveProjectPost.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('focuses one announced summary after keyboard and pointer validation failures without losing values', () => {
    setInputValue(getInput(container, 'Project title'), 'Scout Coffee Brand Site');
    dispatchSeparatedKeyboard(getButton(container, 'Publish Project'), 'Enter');

    let summary = container.querySelector<HTMLElement>('[role="alert"][data-testid="project-post-error-summary"]');
    expect(summary).not.toBeNull();
    expect(summary?.getAttribute('aria-live')).toBe('assertive');
    expect(document.activeElement).toBe(summary);
    expect(container.textContent).toContain('Describe the project goal, deliverables, and expectations.');
    expect(container.textContent).toContain('Add at least one required skill.');
    expect(getInput(container, 'Project title').value).toBe('Scout Coffee Brand Site');

    dispatchPointerClick(getButton(container, 'Publish Project'));
    summary = container.querySelector<HTMLElement>('[role="alert"][data-testid="project-post-error-summary"]');
    expect(container.querySelectorAll('[data-testid="project-post-error-summary"]')).toHaveLength(1);
    expect(document.activeElement).toBe(summary);
    expect(mockSaveProjectPost).toHaveBeenCalledTimes(2);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('clears edited errors and accepts one pointer publish with the retained payload', () => {
    setInputValue(getInput(container, 'Project title'), 'Scout Coffee Brand Site');
    dispatchPointerClick(getButton(container, 'Save Draft'));
    expect(document.activeElement).toBe(container.querySelector('[data-testid="project-post-error-summary"]'));

    setInputValue(getInput(container, 'Project description'), 'Design and prototype a complete responsive coffee brand website.');
    expect(container.textContent).not.toContain('Describe the project goal, deliverables, and expectations.');
    expect(container.querySelector('[data-testid="project-post-error-summary"]')).toBeNull();
    setInputValue(getInput(container, 'Required skills'), 'UI/UX, Web Design');
    dispatchPointerClick(getButton(container, 'Publish Project'));

    expect(mockSaveProjectPost).toHaveBeenCalledTimes(2);
    expect(mockSaveProjectPost).toHaveBeenLastCalledWith(expect.objectContaining({
      title: 'Scout Coffee Brand Site',
      description: 'Design and prototype a complete responsive coffee brand website.',
      skills: ['UI/UX', ' Web Design'],
      budget: 1500,
    }), true, undefined);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/project-posts/[postId]', params: { postId: 'post-open' } });
  });
});
