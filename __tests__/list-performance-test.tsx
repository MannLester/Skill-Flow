import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { ReactNode, useEffect } from 'react';

import AiMentorScreen from '@/app/ai-mentor';
import { buildThreadSummaries } from '@/app/messages';
import { buildProjectPostIndex, buildSubmittedProposalCounts } from '@/app/projects';
import { ProjectMessage, ProjectPost, Proposal, SessionProvider, useSession } from '@/context/session';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args) },
}));

function StudentMentorHarness({ children }: { children: ReactNode }) {
  const { currentAccount, loginAsRole, mentorMessages, sendMentorMessage } = useSession();

  useEffect(() => loginAsRole('student'), [loginAsRole]);
  useEffect(() => {
    if (currentAccount?.role !== 'student' || mentorMessages.length) return;
    for (let index = 0; index < 12; index += 1) sendMentorMessage(`Question ${index}`);
  }, [currentAccount, mentorMessages.length, sendMentorMessage]);

  return <>{children}</>;
}

function message(projectId: string, senderId: string, readBy: string[] = []): ProjectMessage {
  return { id: `${projectId}-${senderId}-${readBy.join('-')}`, projectId, senderId, body: senderId, createdAt: '2026-08-26T00:00:00.000Z', readBy };
}

function projectPost(id: string): ProjectPost {
  return { id, clientId: 'client-mark', title: id, description: id, category: 'Design', budget: 1000, deadline: '2026-09-30', skills: ['UI/UX'], status: 'open', createdAt: '2026-08-26T00:00:00.000Z', updatedAt: '2026-08-26T00:00:00.000Z' };
}

function proposal(id: string, projectPostId: string, status: Proposal['status']): Proposal {
  return { id, projectPostId, studentId: 'student-alex', coverLetter: id, amount: 1000, deliveryDays: 3, status, createdAt: '2026-08-26T00:00:00.000Z' };
}

describe('list performance helpers and virtualization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  });

  it('indexes message summaries in one pass per project', () => {
    const first = message('project-1', 'student-alex', ['student-alex']);
    const unread = message('project-1', 'client-mark');
    const other = message('project-2', 'client-mark', ['student-alex']);

    expect(buildThreadSummaries([first, unread, other], 'student-alex')).toEqual(new Map([
      ['project-1', { latest: unread, unread: 1 }],
      ['project-2', { latest: other, unread: 0 }],
    ]));
  });

  it('indexes project posts and submitted proposal counts without row scans', () => {
    const first = projectPost('post-1');
    const second = projectPost('post-2');
    const submitted = proposal('proposal-1', first.id, 'submitted');
    const withdrawn = proposal('proposal-2', first.id, 'withdrawn');
    const other = proposal('proposal-3', second.id, 'submitted');

    expect(buildProjectPostIndex([first, second])).toEqual(new Map([[first.id, first], [second.id, second]]));
    expect(buildSubmittedProposalCounts([submitted, withdrawn, other])).toEqual(new Map([[first.id, 1], [second.id, 1]]));
  });

  it('renders the mentor transcript through a configured FlatList', async () => {
    const screen = render(<SessionProvider><StudentMentorHarness><AiMentorScreen /></StudentMentorHarness></SessionProvider>);

    await waitFor(() => expect(screen.getByTestId('mentor-transcript')).toBeTruthy());
    const transcript = screen.getByTestId('mentor-transcript');
    const virtualizedList = screen.UNSAFE_getByType(FlatList);
    expect(virtualizedList.props.data).toHaveLength(24);
    expect(virtualizedList.props.initialNumToRender).toBe(10);
    expect(virtualizedList.props.windowSize).toBe(7);
    expect(screen.getByText('Question 0')).toBeTruthy();
    expect(screen.getAllByText(/Break the task into goal/).length).toBeGreaterThan(0);
    expect(transcript.props.testID).toBe('mentor-transcript');
  });

  it('keeps suggestion selection local before sending a mentor question', async () => {
    const screen = render(<SessionProvider><AiMentorScreen /></SessionProvider>);
    await waitFor(() => expect(screen.getByText('Improve my project idea')).toBeTruthy());

    fireEvent.press(screen.getByText('Improve my project idea'));
    expect(screen.getByPlaceholderText('Ask about a project or portfolio…').props.value).toBe('Improve my project idea');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
