import { hexToRgb, rgbToLab, type Lab, type RGB } from "./color";

export interface PaletteColor {
  id: string;
  name: { en: string; vi: string };
  hex: string;
}

export interface Palette {
  id: string;
  name: { en: string; vi: string };
  colors: PaletteColor[];
}

const C = (id: string, en: string, vi: string, hex: string): PaletteColor => ({ id, name: { en, vi }, hex });

/** Brick-inspired colours. Not official colours of any toy manufacturer. */
const ALL = {
  white: C("white", "White", "Trắng", "#F4F4F4"),
  lightGray: C("light-gray", "Light gray", "Xám nhạt", "#A0A5A9"),
  darkGray: C("dark-gray", "Dark gray", "Xám đậm", "#6C6E68"),
  black: C("black", "Black", "Đen", "#1B2A34"),
  red: C("red", "Red", "Đỏ", "#C91A09"),
  darkRed: C("dark-red", "Dark red", "Đỏ sẫm", "#720E0F"),
  coral: C("coral", "Coral", "San hô", "#FF698F"),
  orange: C("orange", "Orange", "Cam", "#FE8A18"),
  lightOrange: C("light-orange", "Light orange", "Cam nhạt", "#F8BB3D"),
  darkOrange: C("dark-orange", "Dark orange", "Cam đất", "#A95500"),
  yellow: C("yellow", "Yellow", "Vàng", "#F2CD37"),
  lightYellow: C("light-yellow", "Light yellow", "Vàng chanh", "#FFF03A"),
  tan: C("tan", "Tan", "Be", "#E4CD9E"),
  darkTan: C("dark-tan", "Dark tan", "Be đậm", "#958A73"),
  lightNougat: C("light-nougat", "Light nougat", "Da nhạt", "#F6D7B3"),
  nougat: C("nougat", "Nougat", "Da", "#D09168"),
  mediumNougat: C("medium-nougat", "Medium nougat", "Nâu da", "#AA7D55"),
  reddishBrown: C("reddish-brown", "Reddish brown", "Nâu đỏ", "#582A12"),
  darkBrown: C("dark-brown", "Dark brown", "Nâu sẫm", "#352100"),
  lime: C("lime", "Lime", "Xanh nõn chuối", "#BBE90B"),
  olive: C("olive", "Olive", "Ô liu", "#9B9A5A"),
  brightGreen: C("bright-green", "Bright green", "Xanh lá tươi", "#4B9F4A"),
  green: C("green", "Green", "Xanh lá", "#237841"),
  darkGreen: C("dark-green", "Dark green", "Xanh rêu", "#184632"),
  sandGreen: C("sand-green", "Sand green", "Xanh xám", "#A0BCAC"),
  mediumAzure: C("medium-azure", "Medium azure", "Xanh ngọc", "#36AEBF"),
  darkAzure: C("dark-azure", "Dark azure", "Xanh biển", "#078BC9"),
  blue: C("blue", "Blue", "Xanh dương", "#0055BF"),
  darkBlue: C("dark-blue", "Dark blue", "Xanh than", "#0A3463"),
  sandBlue: C("sand-blue", "Sand blue", "Xanh xám lam", "#6074A1"),
  lavender: C("lavender", "Lavender", "Tím oải hương", "#AC78BA"),
  darkPurple: C("dark-purple", "Dark purple", "Tím sẫm", "#3F3691"),
  magenta: C("magenta", "Magenta", "Đỏ tía", "#923978"),
  darkPink: C("dark-pink", "Dark pink", "Hồng đậm", "#C870A0"),
  brightPink: C("bright-pink", "Bright pink", "Hồng phấn", "#E4ADC8"),
};

export const PALETTES: Palette[] = [
  { id: "classic", name: { en: "Classic (35 colours)", vi: "Cổ điển (35 màu)" }, colors: Object.values(ALL) },
  {
    id: "mono",
    name: { en: "Monochrome", vi: "Đơn sắc" },
    colors: [ALL.black, ALL.darkGray, ALL.lightGray, ALL.white],
  },
  {
    id: "sepia",
    name: { en: "Sepia", vi: "Sepia" },
    colors: [ALL.darkBrown, ALL.reddishBrown, ALL.mediumNougat, ALL.darkTan, ALL.nougat, ALL.tan, ALL.lightNougat, ALL.white, ALL.black],
  },
  {
    id: "pop",
    name: { en: "Pop art", vi: "Pop art" },
    colors: [ALL.black, ALL.white, ALL.red, ALL.yellow, ALL.blue, ALL.brightGreen, ALL.brightPink, ALL.orange, ALL.mediumAzure],
  },
];

export const DEFAULT_PALETTE_ID = "classic";

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export interface PreparedPalette {
  palette: Palette;
  rgb: RGB[];
  lab: Lab[];
}

export function preparePalette(id: string): PreparedPalette {
  const palette = getPalette(id);
  const rgb = palette.colors.map((c) => hexToRgb(c.hex));
  return { palette, rgb, lab: rgb.map(rgbToLab) };
}
