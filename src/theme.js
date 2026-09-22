import * as Blockly from 'blockly/core';

/* Thème sombre dev + accent teal Arduino (Theme de 1re classe — plus d'overrides CSS). */
export const arduinoDarkTheme = Blockly.Theme.defineTheme('arduinoDark', {
  name: 'arduinoDark',
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#1e1e1e',
    toolboxBackgroundColour: '#252526',
    toolboxForegroundColour: '#d4d4d4',
    flyoutBackgroundColour: '#252526',
    flyoutForegroundColour: '#d4d4d4',
    flyoutOpacity: 1,
    scrollbarColour: '#3c3c3c',
    scrollbarOpacity: 0.5,
    insertionMarkerColour: '#00979D',
    insertionMarkerOpacity: 0.5,
    cursorColour: '#d4d4d4',
  },
  blockStyles: {
    arduino_io: { colourPrimary: '#00979D', colourSecondary: '#006e73', colourTertiary: '#2bc1c9' },
    arduino_logic: { colourPrimary: '#5b67c9', colourSecondary: '#414c9c', colourTertiary: '#7b86e6' },
    arduino_time: { colourPrimary: '#e7662d', colourSecondary: '#9c4518', colourTertiary: '#f08c5c' },
    math_blocks: { colourPrimary: '#3b9c5e', colourSecondary: '#2a6e42', colourTertiary: '#5fc28a' },
  },
});