import { expect, it } from 'vitest';
import {
  defaultSidebarWidth,
  effectiveSidebarWidth,
  loadSidebarWidth,
  parseSidebarWidth,
  saveSidebarWidth,
  sidebarWidthBounds,
  SIDEBAR_WIDTH_KEY,
} from '../../src/lib/sidebar-width';

it('reserves usable workspace width at the narrow desktop boundary', () => {
  expect(sidebarWidthBounds(801)).toEqual({ min: 208, max: 281 });
  expect(sidebarWidthBounds(880)).toEqual({ min: 208, max: 360 });
  expect(sidebarWidthBounds(1440)).toEqual({ min: 208, max: 360 });
  expect(effectiveSidebarWidth(360, 801)).toBe(281);
  expect(801 - effectiveSidebarWidth(360, 801)).toBe(520);
});

it('keeps the preferred width available when the viewport grows again', () => {
  const preferred = 350;
  expect(effectiveSidebarWidth(preferred, 801)).toBe(281);
  expect(effectiveSidebarWidth(preferred, 1440)).toBe(350);
  expect(defaultSidebarWidth(1200)).toBe(220);
  expect(defaultSidebarWidth(1201)).toBe(248);
  expect(effectiveSidebarWidth(null, 1200)).toBe(220);
  expect(effectiveSidebarWidth(null, 1440)).toBe(248);
});

it('accepts only canonical bounded integer preferences and rejects corrupt browser values', () => {
  for (const raw of ['208', '248', '360']) expect(parseSidebarWidth(raw)).toBe(Number(raw));
  for (const raw of [
    null,
    '',
    ' ',
    '207',
    '361',
    '-248',
    '248.5',
    '248.0',
    'NaN',
    'Infinity',
    '3e2',
    '"248"',
    '{"width":248}',
  ])
    expect(parseSidebarWidth(raw)).toBeNull();
});

it('has finite bounded fallbacks for invalid size calculations', () => {
  for (const size of [NaN, Infinity, -1, 0]) {
    expect(sidebarWidthBounds(size)).toEqual({ min: 208, max: 360 });
    expect(effectiveSidebarWidth(null, size)).toBe(248);
  }
  expect(effectiveSidebarWidth(NaN, 1440)).toBe(248);
  expect(effectiveSidebarWidth(10000, 1440)).toBe(360);
  expect(effectiveSidebarWidth(-100, 1440)).toBe(208);
});

it('saves and resets only the layout preference, preserving research content', () => {
  const values = new Map([['abundance-access:research:v1', 'existing notes']]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  expect(saveSidebarWidth(storage, 320)).toBe(true);
  expect(loadSidebarWidth(storage)).toBe(320);
  expect(values.get(SIDEBAR_WIDTH_KEY)).toBe('320');
  expect(saveSidebarWidth(storage, null)).toBe(true);
  expect(loadSidebarWidth(storage)).toBeNull();
  expect(values.get('abundance-access:research:v1')).toBe('existing notes');
  expect(saveSidebarWidth(storage, 400)).toBe(false);
  expect(saveSidebarWidth(storage, NaN)).toBe(false);
  expect(values.has(SIDEBAR_WIDTH_KEY)).toBe(false);
});

it('tolerates denied or unavailable browser storage without throwing', () => {
  const denied = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('quota');
    },
    removeItem: () => {
      throw new Error('denied');
    },
  };
  expect(loadSidebarWidth(denied)).toBeNull();
  expect(loadSidebarWidth(null)).toBeNull();
  expect(saveSidebarWidth(denied, 300)).toBe(false);
  expect(saveSidebarWidth(denied, null)).toBe(false);
  expect(saveSidebarWidth(null, 300)).toBe(false);
});
