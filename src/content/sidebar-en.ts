export const sidebarCopy = {
  resize: 'Resize sidebar',
  resizeHelp:
    'Drag the sidebar edge to resize. Use Left or Right arrow keys to adjust, Home or End for the limits, and Enter or double-click to restore the default width.',
  width: (pixels: number) => `${pixels} pixels`,
} as const;
