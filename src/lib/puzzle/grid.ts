/** Picks rows x cols close to the requested piece count while keeping pieces roughly square. */
export function computeGrid(aspect: number, pieces: number): { rows: number; cols: number } {
  const cols = Math.max(1, Math.round(Math.sqrt(pieces * aspect)));
  const rows = Math.max(1, Math.round(pieces / cols));
  return { rows, cols };
}

/** Studs per piece side so the long side of the mosaic is close to `detail` studs. */
export function studsPerPiece(rows: number, cols: number, detail: number): number {
  return Math.max(2, Math.round(detail / Math.max(rows, cols)));
}

export function isEdgePiece(i: number, rows: number, cols: number): boolean {
  const r = Math.floor(i / cols);
  const c = i % cols;
  return r === 0 || c === 0 || r === rows - 1 || c === cols - 1;
}

export function parseAspect(a: string): number {
  const [w, h] = a.split(":").map(Number);
  return w > 0 && h > 0 ? w / h : 1;
}
