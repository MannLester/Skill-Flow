import { primaryNavActiveForPath, primaryTabDirection, primaryTabOrder, primaryTabRoute, replacePrimaryTab } from '@/navigation/primary-navigation';

describe('primary navigation shell', () => {
  it('defines role-correct primary order and canonical routes', () => {
    expect(primaryTabOrder('student')).toEqual(['home', 'projects', 'portfolio', 'messages', 'profile']);
    expect(primaryTabOrder('client')).toEqual(['home', 'projects', 'messages', 'saved', 'profile']);
    expect(primaryTabRoute('student', 'home')).toBe('/student-home');
    expect(primaryTabRoute('client', 'home')).toBe('/client-home');
    expect(primaryTabRoute('client', 'saved')).toEqual({ pathname: '/marketplace', params: { saved: 'true' } });
    expect(primaryNavActiveForPath('/student-home', 'student')).toBe('home');
    expect(primaryNavActiveForPath('/projects', 'client')).toBe('projects');
    expect(primaryNavActiveForPath('/marketplace', 'client', 'true')).toBe('saved');
    expect(primaryNavActiveForPath('/settings', 'student')).toBeNull();
  });

  it('chooses direction by visual tab order and replaces without repeating the active tab', () => {
    expect(primaryTabDirection('student', 'home', 'messages')).toBe(1);
    expect(primaryTabDirection('student', 'profile', 'projects')).toBe(-1);
    expect(primaryTabDirection('client', 'saved', 'saved')).toBe(0);
    const replace = jest.fn();
    expect(replacePrimaryTab('student', 'home', 'projects', replace)).toBe(true);
    expect(replace).toHaveBeenCalledWith('/projects');
    expect(replacePrimaryTab('student', 'home', 'home', replace)).toBe(false);
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
