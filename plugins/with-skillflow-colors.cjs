const { AndroidConfig, withAndroidColors, withAndroidColorsNight } = require('expo/config-plugins');

// Keep these native resources in sync with the iOS and web colors in src/constants/theme.ts.
const palettes = {
  light: {
    burgundy: '#7c1019', background: '#ffffff', ink: '#171717', muted: '#747474',
    border: '#e8e8e8', surface: '#f8f8f8', blush: '#fff0f1', blush_strong: '#f8dfe2',
    green_soft: '#e8f7ec', warning_surface: '#fff6df', gray_switch: '#d9d9d9',
  },
  dark: {
    burgundy: '#ff9ba4', background: '#121212', ink: '#f5f5f5', muted: '#b8b8b8',
    border: '#3d3d3d', surface: '#242424', blush: '#3a2023', blush_strong: '#52292e',
    green_soft: '#1d3825', warning_surface: '#3b321d', gray_switch: '#555555',
  },
};

function setPalette(resources, palette) {
  for (const [name, value] of Object.entries(palette)) {
    AndroidConfig.Colors.assignColorValue(resources, { name: `skillflow_${name}`, value });
  }
  return resources;
}

module.exports = function withSkillFlowColors(config) {
  config = withAndroidColors(config, (mod) => {
    mod.modResults = setPalette(mod.modResults, palettes.light);
    return mod;
  });
  return withAndroidColorsNight(config, (mod) => {
    mod.modResults = setPalette(mod.modResults, palettes.dark);
    return mod;
  });
};
