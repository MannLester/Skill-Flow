import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReactNode, useEffect } from 'react';
import { Alert, Text } from 'react-native';

import { ProjectPostForm } from '@/components/project-post-form';
import { SessionProvider, useSession } from '@/context/session';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }));

const validValues = {
  title: 'Scout Coffee Brand Site',
  description: 'Design and prototype a complete responsive coffee brand website.',
  skills: 'UI/UX, Web Design',
};

function RoleSession({ role, children }: { role: 'client' | 'student'; children: ReactNode }) {
  const { currentAccount, loginAsRole, projectPosts } = useSession();
  useEffect(() => loginAsRole(role), [loginAsRole, role]);
  return <><Text testID="account-name">{currentAccount?.name}</Text><Text testID="project-count">{projectPosts.length}</Text>{children}</>;
}

function renderForm(role: 'client' | 'student' = 'client') {
  return render(<SessionProvider><RoleSession role={role}><ProjectPostForm /></RoleSession></SessionProvider>);
}

function fillValidFields(screen: ReturnType<typeof render>) {
  fireEvent.changeText(screen.getByLabelText('Project title'), validValues.title);
  fireEvent.changeText(screen.getByLabelText('Project description'), validValues.description);
  fireEvent.changeText(screen.getByLabelText('Required skills'), validValues.skills);
}

describe('Client project-post validation feedback', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(['Publish Project', 'Save Draft'])('keeps values and shows accessible field guidance after invalid %s', async (action) => {
    const screen = renderForm();
    await waitFor(() => expect(screen.getByTestId('account-name').props.children).toBe('Mark C.'));
    fireEvent.changeText(screen.getByLabelText('Project title'), validValues.title);
    fireEvent.press(screen.getByText(action));

    const summary = screen.getByTestId('project-post-error-summary');
    expect(summary.props.accessibilityRole).toBe('alert');
    expect(summary.props.accessibilityLiveRegion).toBe('assertive');
    expect(screen.getByText('Complete every project field with valid values. Edit the highlighted fields and try again.')).toBeTruthy();
    expect(screen.getByText('Describe the project goal, deliverables, and expectations.')).toBeTruthy();
    expect(screen.getByText('Add at least one required skill.')).toBeTruthy();
    expect(screen.getByLabelText('Project title').props.value).toBe(validValues.title);
    expect(screen.getByTestId('project-count').props.children).toBe(1);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('identifies invalid category, budget, and deadline requirements', async () => {
    const screen = renderForm();
    await waitFor(() => expect(screen.getByTestId('account-name').props.children).toBe('Mark C.'));
    fireEvent.changeText(screen.getByLabelText('Project category'), '');
    fireEvent.changeText(screen.getByLabelText('Project budget'), 'not-a-number');
    fireEvent.changeText(screen.getByLabelText('Project deadline'), 'not-a-date');
    fireEvent.press(screen.getByText('Publish Project'));

    expect(screen.getByText('Enter a category.')).toBeTruthy();
    expect(screen.getByText('Enter a valid budget greater than zero.')).toBeTruthy();
    expect(screen.getByText('Enter a valid deadline such as 2026-09-30.')).toBeTruthy();
    expect(screen.getByTestId('project-count').props.children).toBe(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it.each(['not-a-number', 'Infinity', '-Infinity'])('rejects sole-invalid budget %s before mutation and publishes once after recovery', async (budget) => {
    const screen = renderForm();
    await waitFor(() => expect(screen.getByTestId('account-name').props.children).toBe('Mark C.'));
    fillValidFields(screen);
    fireEvent.changeText(screen.getByLabelText('Project budget'), budget);
    fireEvent.press(screen.getByText('Publish Project'));

    expect(screen.getByText('Enter a valid budget greater than zero.')).toBeTruthy();
    expect(screen.getByTestId('project-count').props.children).toBe(1);
    expect(screen.getByLabelText('Project title').props.value).toBe(validValues.title);
    expect(screen.getByLabelText('Project description').props.value).toBe(validValues.description);
    expect(screen.getByLabelText('Required skills').props.value).toBe(validValues.skills);
    expect(mockReplace).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('Project budget'), '1500');
    expect(screen.queryByText('Enter a valid budget greater than zero.')).toBeNull();
    expect(screen.queryByTestId('project-post-error-summary')).toBeNull();
    fireEvent.press(screen.getByText('Publish Project'));

    expect(screen.getByTestId('project-count').props.children).toBe(2);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/project-posts/[postId]', params: { postId: expect.any(String) } });
  });

  it('clears corrected errors and publishes exactly one post after a valid retry', async () => {
    const screen = renderForm();
    await waitFor(() => expect(screen.getByTestId('account-name').props.children).toBe('Mark C.'));
    fireEvent.changeText(screen.getByLabelText('Project title'), validValues.title);
    fireEvent.press(screen.getByText('Publish Project'));

    fireEvent.changeText(screen.getByLabelText('Project description'), validValues.description);
    expect(screen.queryByText('Describe the project goal, deliverables, and expectations.')).toBeNull();
    expect(screen.queryByTestId('project-post-error-summary')).toBeNull();
    expect(screen.getByText('Add at least one required skill.')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Required skills'), validValues.skills);
    fireEvent.press(screen.getByText('Publish Project'));

    expect(screen.getByTestId('project-count').props.children).toBe(2);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('project-post-error-summary')).toBeNull();
  });

  it('preserves the Student role guard', async () => {
    const screen = renderForm('student');
    await waitFor(() => expect(screen.getByTestId('account-name').props.children).toBe('Alex D.'));
    expect(screen.getByText('Only Clients can create project posts.')).toBeTruthy();
    expect(screen.queryByText('Publish Project')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
