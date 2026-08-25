import { fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { ProjectPostForm } from '@/components/project-post-form';

const mockReplace = jest.fn();
const mockSaveProjectPost = jest.fn();
let mockRole: 'client' | 'student' = 'client';

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

jest.mock('@/context/session', () => ({
  useSession: () => ({
    currentAccount: { id: mockRole === 'client' ? 'client-mark' : 'student-alex', role: mockRole },
    projectPosts: [],
    saveProjectPost: (...args: unknown[]) => mockSaveProjectPost(...args),
    setProjectPostStatus: jest.fn(),
  }),
}));

const validPost = {
  id: 'post-new', clientId: 'client-mark', title: 'Scout Coffee Brand Site', category: 'Web & App',
  description: 'Design and prototype a complete responsive coffee brand website.', budget: 1500,
  deadline: '2026-09-30', skills: ['UI/UX', 'Web Design'], status: 'open', createdAt: '2026-08-26', updatedAt: '2026-08-26',
};

describe('Client project-post validation feedback', () => {
  beforeEach(() => {
    mockRole = 'client';
    mockReplace.mockClear();
    mockSaveProjectPost.mockReset();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(['Publish Project', 'Save Draft'])('keeps values and shows accessible field guidance after invalid %s', (action) => {
    mockSaveProjectPost.mockReturnValue({ ok: false, message: 'Complete every project field with valid values.' });
    const screen = render(<ProjectPostForm />);
    fireEvent.changeText(screen.getByLabelText('Project title'), validPost.title);

    fireEvent.press(screen.getByText(action));

    const summary = screen.getByTestId('project-post-error-summary');
    expect(summary.props.accessibilityRole).toBe('alert');
    expect(summary.props.accessibilityLiveRegion).toBe('assertive');
    expect(screen.getByText('Complete every project field with valid values. Edit the highlighted fields and try again.')).toBeTruthy();
    expect(screen.getByText('Describe the project goal, deliverables, and expectations.')).toBeTruthy();
    expect(screen.getByText('Add at least one required skill.')).toBeTruthy();
    expect(screen.getByLabelText('Project title').props.value).toBe(validPost.title);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('identifies invalid category, budget, and deadline requirements', () => {
    mockSaveProjectPost.mockReturnValue({ ok: false, message: 'Complete every project field with valid values.' });
    const screen = render(<ProjectPostForm />);
    fireEvent.changeText(screen.getByLabelText('Project category'), '');
    fireEvent.changeText(screen.getByLabelText('Project budget'), 'not-a-number');
    fireEvent.changeText(screen.getByLabelText('Project deadline'), 'not-a-date');

    fireEvent.press(screen.getByText('Publish Project'));

    expect(screen.getByText('Enter a category.')).toBeTruthy();
    expect(screen.getByText('Enter a valid budget greater than zero.')).toBeTruthy();
    expect(screen.getByText('Enter a valid deadline such as 2026-09-30.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('clears corrected errors and publishes exactly one post after a valid retry', () => {
    mockSaveProjectPost
      .mockReturnValueOnce({ ok: false, message: 'Complete every project field with valid values.' })
      .mockReturnValueOnce({ ok: true, projectPost: validPost });
    const screen = render(<ProjectPostForm />);
    fireEvent.changeText(screen.getByLabelText('Project title'), validPost.title);
    fireEvent.press(screen.getByText('Publish Project'));

    fireEvent.changeText(screen.getByLabelText('Project description'), validPost.description);
    expect(screen.queryByText('Describe the project goal, deliverables, and expectations.')).toBeNull();
    expect(screen.queryByTestId('project-post-error-summary')).toBeNull();
    expect(screen.getByText('Add at least one required skill.')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Required skills'), 'UI/UX, Web Design');
    fireEvent.press(screen.getByText('Publish Project'));

    expect(mockSaveProjectPost).toHaveBeenCalledTimes(2);
    expect(mockSaveProjectPost).toHaveBeenLastCalledWith(expect.objectContaining({
      title: validPost.title, description: validPost.description, skills: ['UI/UX', ' Web Design'], budget: 1500,
    }), true, undefined);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/project-posts/[postId]', params: { postId: validPost.id } });
    expect(screen.queryByTestId('project-post-error-summary')).toBeNull();
  });

  it('preserves the Student role guard', () => {
    mockRole = 'student';
    const screen = render(<ProjectPostForm />);
    expect(screen.getByText('Only Clients can create project posts.')).toBeTruthy();
    expect(screen.queryByText('Publish Project')).toBeNull();
    expect(mockSaveProjectPost).not.toHaveBeenCalled();
  });
});
