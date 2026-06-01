// SubstanceMetrics logic.
// SC-001: a phase passes if it produced enough substantive work, measured by
// non-empty/non-decoration lines OR total non-whitespace chars.

export interface SubstanceMetrics {
  lines: number;
  chars: number;
}

const DECORATION = new Set(["#", "-", "*", "_", "=", "|", " "]);

export function substanceMetrics(body: string): SubstanceMetrics {
  let lines = 0;
  let chars = 0;
  for (const raw of body.split("\n")) {
    const t = raw.trim();
    if (t.length === 0) continue;
    // a line counts only if it has at least one non-decoration character
    let hasLetter = false;
    for (const c of t) {
      if (!DECORATION.has(c)) {
        hasLetter = true;
        break;
      }
    }
    if (!hasLetter) continue;
    lines += 1;
    for (const c of t) {
      if (!/\s/.test(c)) chars += 1;
    }
  }
  return { lines, chars };
}

/** Pass when lines ≥ minLines OR chars ≥ minLines × 60. */
export function meetsThreshold(m: SubstanceMetrics, minLines: number): boolean {
  return m.lines >= minLines || m.chars >= minLines * 60;
}
