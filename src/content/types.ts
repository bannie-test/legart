export type Locale = "en" | "vi";
export type L10n = { en: string; vi: string };

export interface QuizQuestion {
  id: string;
  question: L10n;
  /** The first option is the correct one; options are shuffled when shown. */
  options: [L10n, L10n, L10n, L10n];
  explain: L10n;
}

export interface Artwork {
  id: string;
  title: L10n;
  artist: string;
  year: string;
  museum: L10n;
  /** Puzzle aspect ratio; the picture is centre-cropped to it. */
  aspect: string;
  /** File name on Wikimedia Commons, used by scripts/fetch-library.mjs. */
  commons: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  funFact: L10n;
  quiz: QuizQuestion[];
}

export const l = (en: string, vi: string): L10n => ({ en, vi });
