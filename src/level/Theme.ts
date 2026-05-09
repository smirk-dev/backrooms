import { Color } from "three";

export interface Theme {
  id: string;
  wallpaper: Color;
  trim: Color;
  carpet: Color;
  ceiling: Color;
  fixture: Color;
  fixtureEmissive: number;
  ambient: Color;
  fog: Color;
  fogDensity: number;
  hasCarpet: boolean;
  /** When true, ceiling is darker / partially absent (garage). */
  industrial: boolean;
  /** When true, the floor renders a thin transparent water plane above the carpet. */
  flooded: boolean;
}

export const THEMES: Record<string, Theme> = {
  lobby: {
    id: "lobby",
    wallpaper: new Color(0xc7a648),
    trim: new Color(0xb89432),
    carpet: new Color(0x554a2c),
    ceiling: new Color(0xe9dcb0),
    fixture: new Color(0xfff4b8),
    fixtureEmissive: 1.6,
    ambient: new Color(0x453a1f),
    fog: new Color(0x0a0902),
    fogDensity: 0.07,
    hasCarpet: true,
    industrial: false,
    flooded: false,
  },
  offices: {
    id: "offices",
    wallpaper: new Color(0xb8b09a),
    trim: new Color(0x8a826e),
    carpet: new Color(0x3a3a3e),
    ceiling: new Color(0xd0c8b2),
    fixture: new Color(0xfff8d0),
    fixtureEmissive: 1.1,
    ambient: new Color(0x32302a),
    fog: new Color(0x0c0c0e),
    fogDensity: 0.08,
    hasCarpet: true,
    industrial: false,
    flooded: false,
  },
  garage: {
    id: "garage",
    wallpaper: new Color(0x6a6864),
    trim: new Color(0x3c3a36),
    carpet: new Color(0x2a2a2c),
    ceiling: new Color(0x44423e),
    fixture: new Color(0xb6c4d8),
    fixtureEmissive: 0.6,
    ambient: new Color(0x1a1c20),
    fog: new Color(0x05060a),
    fogDensity: 0.13,
    hasCarpet: false,
    industrial: true,
    flooded: false,
  },
  flooded: {
    id: "flooded",
    wallpaper: new Color(0x6e7a72),
    trim: new Color(0x3a4a44),
    carpet: new Color(0x152422),
    ceiling: new Color(0x586862),
    fixture: new Color(0xc4d8e8),
    fixtureEmissive: 0.4,
    ambient: new Color(0x12181a),
    fog: new Color(0x040608),
    fogDensity: 0.18,
    hasCarpet: false,
    industrial: false,
    flooded: true,
  },
  same: {
    id: "same",
    wallpaper: new Color(0xc7a648),
    trim: new Color(0xb89432),
    carpet: new Color(0x554a2c),
    ceiling: new Color(0xe9dcb0),
    fixture: new Color(0xfff4b8),
    fixtureEmissive: 1.6,
    ambient: new Color(0x453a1f),
    fog: new Color(0x0a0902),
    fogDensity: 0.09,
    hasCarpet: true,
    industrial: false,
    flooded: false,
  },
  exit: {
    id: "exit",
    wallpaper: new Color(0xfff8e0),
    trim: new Color(0xfff0c4),
    carpet: new Color(0x9c8a52),
    ceiling: new Color(0xfff8e0),
    fixture: new Color(0xffffff),
    fixtureEmissive: 3.5,
    ambient: new Color(0xa89c70),
    fog: new Color(0xe6dcb0),
    fogDensity: 0.05,
    hasCarpet: true,
    industrial: false,
    flooded: false,
  },
};
