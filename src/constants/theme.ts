import { DynamicColorIOS, Platform, PlatformColor } from 'react-native';

function adaptiveColor(light: string, dark: string, resourceName: string) {
  if (Platform.OS === 'ios') return DynamicColorIOS({ light, dark });
  if (Platform.OS === 'android') return PlatformColor(`@color/skillflow_${resourceName}`);
  return light;
}

export const colors = {
  red: '#d60000', deepRed: '#a70000', burgundy: adaptiveColor('#7c1019', '#ff9ba4', 'burgundy'), white: '#ffffff',
  background: adaptiveColor('#ffffff', '#121212', 'background'),
  ink: adaptiveColor('#171717', '#f5f5f5', 'ink'),
  muted: adaptiveColor('#747474', '#b8b8b8', 'muted'),
  border: adaptiveColor('#e8e8e8', '#3d3d3d', 'border'),
  surface: adaptiveColor('#f8f8f8', '#242424', 'surface'),
  blush: adaptiveColor('#fff0f1', '#3a2023', 'blush'),
  blushStrong: adaptiveColor('#f8dfe2', '#52292e', 'blush_strong'), green: '#4c9b5f',
  greenSoft: adaptiveColor('#e8f7ec', '#1d3825', 'green_soft'), gold: '#f3a517',
  warningSurface: adaptiveColor('#fff6df', '#3b321d', 'warning_surface'),
  graySwitch: adaptiveColor('#d9d9d9', '#555555', 'gray_switch'),
};

// Account access screens use fixed colors so Android theme changes cannot invert them.
export const authColors = {
  background: '#faf9f7',
  text: '#242424',
  muted: '#666666',
  field: '#ffffff',
  border: '#d8d4d2',
  accent: '#7c1019',
};

export const font = {
  regular: 'Poppins_400Regular', medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold', bold: 'Poppins_700Bold',
};

export const shadow = Platform.select({
  android: { elevation: 3 },
  web: { boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.1)' },
  default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 },
});

export const MAX_PHONE_WIDTH = 480;
export const contentPadding = 20;
