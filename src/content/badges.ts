import { ARTWORKS } from "./artworks";
import { l, type L10n } from "./types";

interface AttemptLike {
  sourceKind: string;
  sourceId: string;
  pieces: number;
  shape: string;
  mode: string;
  totalMs: number;
  quizCorrect: number;
  quizTotal: number;
  hints: number;
  peeks: number;
}

export interface Badge {
  id: string;
  icon: string;
  name: L10n;
  desc: L10n;
  test: (all: AttemptLike[]) => boolean;
}

export const BADGES: Badge[] = [
  { id: "first", icon: "🧱", name: l("First brick", "Viên gạch đầu tiên"), desc: l("Finish your first puzzle", "Hoàn thành tranh đầu tiên"), test: (a) => a.length >= 1 },
  { id: "ten", icon: "🔟", name: l("Builder", "Thợ xây"), desc: l("Finish 10 puzzles", "Hoàn thành 10 tranh"), test: (a) => a.length >= 10 },
  { id: "fifty", icon: "🏗️", name: l("Master builder", "Kiến trúc sư"), desc: l("Finish 50 puzzles", "Hoàn thành 50 tranh"), test: (a) => a.length >= 50 },
  {
    id: "collector", icon: "🖼️", name: l("Renaissance collector", "Nhà sưu tầm Phục Hưng"), desc: l("Finish all 20 library paintings", "Ghép đủ 20 tranh thư viện"),
    test: (a) => ARTWORKS.every((art) => a.some((x) => x.sourceKind === "library" && x.sourceId === art.id)),
  },
  { id: "speed", icon: "⚡", name: l("Lightning hands", "Tay nhanh như chớp"), desc: l("36+ pieces in under 60 seconds", "36 mảnh trở lên dưới 60 giây"), test: (a) => a.some((x) => x.pieces >= 36 && x.totalMs < 60_000) },
  { id: "expert", icon: "💎", name: l("Expert", "Siêu khó"), desc: l("Finish a puzzle in expert mode", "Hoàn thành một tranh ở chế độ Siêu khó"), test: (a) => a.some((x) => x.mode === "expert") },
  { id: "jigsaw100", icon: "🧩", name: l("Jigsaw marathon", "Marathon jigsaw"), desc: l("Finish a 100+ piece jigsaw", "Ghép xong jigsaw từ 100 mảnh"), test: (a) => a.some((x) => x.shape === "jigsaw" && x.pieces >= 100) },
  { id: "scholar", icon: "🎓", name: l("Art scholar", "Học giả nghệ thuật"), desc: l("Answer 3/3 quiz questions", "Trả lời đúng 3/3 câu quiz"), test: (a) => a.some((x) => x.quizTotal >= 3 && x.quizCorrect === x.quizTotal) },
  { id: "blind", icon: "🙈", name: l("From memory", "Nhớ như in"), desc: l("Finish hard mode without peeking or hints", "Xong chế độ Khó không xem ảnh, không gợi ý"), test: (a) => a.some((x) => x.mode !== "easy" && x.peeks === 0 && x.hints === 0) },
  { id: "own", icon: "📷", name: l("My masterpiece", "Kiệt tác của tôi"), desc: l("Finish a puzzle made from your own photo", "Ghép xong tranh từ ảnh của bạn"), test: (a) => a.some((x) => x.sourceKind === "local" || x.sourceKind === "cloud") },
];
