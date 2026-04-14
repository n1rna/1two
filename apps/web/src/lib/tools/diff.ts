export type LineType = "equal" | "added" | "removed";

export interface DiffLine {
  text: string;
  type: LineType;
  lineNumLeft?: number;
  lineNumRight?: number;
}

/**
 * Compute a line-by-line diff between two texts using the LCS algorithm.
 */
export function computeDiff(left: string, right: string): DiffLine[] {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");

  const lcs = buildLcs(leftLines, rightLines);
  const result: DiffLine[] = [];

  let li = 0;
  let ri = 0;
  let ci = 0;
  let leftNum = 1;
  let rightNum = 1;

  while (li < leftLines.length || ri < rightLines.length) {
    if (ci < lcs.length && li < leftLines.length && leftLines[li] === lcs[ci] && ri < rightLines.length && rightLines[ri] === lcs[ci]) {
      result.push({ text: leftLines[li], type: "equal", lineNumLeft: leftNum, lineNumRight: rightNum });
      li++;
      ri++;
      ci++;
      leftNum++;
      rightNum++;
    } else if (li < leftLines.length && (ci >= lcs.length || leftLines[li] !== lcs[ci])) {
      result.push({ text: leftLines[li], type: "removed", lineNumLeft: leftNum });
      li++;
      leftNum++;
    } else if (ri < rightLines.length && (ci >= lcs.length || rightLines[ri] !== lcs[ci])) {
      result.push({ text: rightLines[ri], type: "added", lineNumRight: rightNum });
      ri++;
      rightNum++;
    }
  }

  return result;
}

function buildLcs(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

export function getDiffStats(diff: DiffLine[]): DiffStats {
  return diff.reduce(
    (acc, line) => {
      if (line.type === "added") acc.added++;
      else if (line.type === "removed") acc.removed++;
      else acc.unchanged++;
      return acc;
    },
    { added: 0, removed: 0, unchanged: 0 }
  );
}
