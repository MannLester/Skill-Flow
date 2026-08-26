import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, Text } from 'react-native';
import { ReactNode, useEffect } from 'react';

import NewPortfolioItemScreen from '@/app/portfolio/new';
import { SessionProvider, useSession } from '@/context/session';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockBack(...args) },
}));

function StudentSession({ children }: { children: ReactNode }) {
  const { currentAccount, loginAsRole, portfolioItems } = useSession();
  useEffect(() => loginAsRole('student'), [loginAsRole]);
  const portfolioCount = portfolioItems.filter((item) => item.studentId === currentAccount?.id).length;
  return <><Text>{currentAccount?.name ?? 'Loading student session'}</Text><Text testID="portfolio-count">{portfolioCount}</Text>{children}</>;
}

function renderScreen() {
  return render(<SessionProvider><StudentSession><NewPortfolioItemScreen /></StudentSession></SessionProvider>);
}

describe('add portfolio item validation', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => alertSpy.mockRestore());

  it('keeps the form editable and exposes accessible errors after an invalid retry', async () => {
    const screen = renderScreen();
    await waitFor(() => expect(screen.getByText('Alex D.')).toBeTruthy());

    fireEvent.press(screen.getByText('Add to Portfolio'));

    expect(screen.getByText('Unable to add portfolio item')).toBeTruthy();
    expect(screen.getByText('Complete the portfolio title, category, and description. Edit the highlighted fields and try again.')).toBeTruthy();
    expect(screen.getByText('Enter a project title.')).toBeTruthy();
    expect(screen.getByText('Enter a category.')).toBeTruthy();
    expect(screen.getByText('Describe the work, skills, and outcome.')).toBeTruthy();
    expect(screen.getByLabelText('Project title').props.accessibilityHint).toBe('Enter a project title.');
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('Project title'), 'Poster Study');
    expect(screen.getByLabelText('Project title').props.value).toBe('Poster Study');
    expect(screen.queryByText('Enter a project title.')).toBeNull();
    expect(screen.getByText('Enter a category.')).toBeTruthy();

    fireEvent.press(screen.getByText('Add to Portfolio'));
    expect(screen.getByText('Enter a category.')).toBeTruthy();
    expect(screen.getByText('Describe the work, skills, and outcome.')).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('clears validation feedback after an edited successful retry', async () => {
    const screen = renderScreen();
    await waitFor(() => expect(screen.getByText('Alex D.')).toBeTruthy());

    fireEvent.press(screen.getByText('Add to Portfolio'));
    fireEvent.changeText(screen.getByLabelText('Project title'), 'Poster Study');
    fireEvent.changeText(screen.getByLabelText('Portfolio category'), 'Poster Design');
    fireEvent.changeText(screen.getByLabelText('Portfolio description'), 'A sample poster project.');
    fireEvent.press(screen.getByText('Add to Portfolio'));

    expect(screen.queryByText('Unable to add portfolio item')).toBeNull();
    expect(screen.queryByText('Enter a project title.')).toBeNull();
    expect(screen.queryByText('Enter a category.')).toBeNull();
    expect(screen.queryByText('Describe the work, skills, and outcome.')).toBeNull();
    expect(screen.getByTestId('portfolio-count').props.children).toBe(2);
    expect(alertSpy).toHaveBeenCalledWith('Portfolio updated', 'The work sample was added locally.');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
