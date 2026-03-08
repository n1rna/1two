export interface JsonParseResult {
  valid: boolean;
  value?: unknown;
  formatted?: string;
  corrected?: boolean;
  corrections?: string[];
  error?: JsonError;
}

export interface JsonError {
  message: string;
  line?: number;
  column?: number;
}

export function formatJson(input: string, indent: number = 2): string {
  const parsed = JSON.parse(input);
  return JSON.stringify(parsed, null, indent);
}

export function minifyJson(input: string): string {
  const parsed = JSON.parse(input);
  return JSON.stringify(parsed);
}

/**
 * Attempts to fix common JSON issues before parsing.
 * Returns the parse result with details about any corrections made.
 */
export function smartParseJson(input: string): JsonParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, error: { message: "Empty input" } };
  }

  // Try parsing as-is first
  try {
    const value = JSON.parse(trimmed);
    return { valid: true, value, formatted: JSON.stringify(value, null, 2) };
  } catch {
    // Continue to corrections
  }

  // Apply corrections
  const corrections: string[] = [];
  let fixed = trimmed;

  // 1. Remove wrapping quotes if the string looks like a JSON object/array inside quotes
  if (
    (fixed.startsWith('"') && fixed.endsWith('"')) ||
    (fixed.startsWith("'") && fixed.endsWith("'"))
  ) {
    const inner = fixed.slice(1, -1);
    const unescaped = inner.replace(/\\"/g, '"').replace(/\\'/g, "'");
    if (
      (unescaped.trimStart().startsWith("{") && unescaped.trimEnd().endsWith("}")) ||
      (unescaped.trimStart().startsWith("[") && unescaped.trimEnd().endsWith("]"))
    ) {
      fixed = unescaped;
      corrections.push("Removed wrapping quotes and unescaped content");
    }
  }

  // 2. Unescape escaped double quotes (common when copying from code)
  if (fixed.includes('\\"') && !fixed.includes('"\\"')) {
    const before = fixed;
    fixed = fixed.replace(/\\"/g, '"');
    // This might double-quote things, so only keep if it starts/ends with { or [
    if (
      (fixed.trimStart().startsWith("{") || fixed.trimStart().startsWith("[")) &&
      tryParse(fixed)
    ) {
      corrections.push("Unescaped double quotes");
    } else {
      fixed = before;
    }
  }

  // 3. Replace single quotes with double quotes (but not inside strings)
  if (fixed.includes("'")) {
    const singleToDouble = replaceSingleQuotes(fixed);
    if (singleToDouble !== fixed && tryParse(singleToDouble)) {
      fixed = singleToDouble;
      corrections.push("Replaced single quotes with double quotes");
    }
  }

  // 4. Remove trailing commas before } or ]
  {
    const noTrailing = fixed.replace(/,(\s*[}\]])/g, "$1");
    if (noTrailing !== fixed && tryParse(noTrailing)) {
      fixed = noTrailing;
      corrections.push("Removed trailing commas");
    }
  }

  // 5. Add missing quotes around unquoted keys
  {
    const quotedKeys = fixed.replace(
      /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g,
      '$1"$2"$3'
    );
    if (quotedKeys !== fixed && tryParse(quotedKeys)) {
      fixed = quotedKeys;
      corrections.push("Added quotes around unquoted keys");
    }
  }

  // Try parsing the corrected string
  try {
    const value = JSON.parse(fixed);
    return {
      valid: true,
      value,
      formatted: JSON.stringify(value, null, 2),
      corrected: corrections.length > 0,
      corrections,
    };
  } catch {
    // Corrections weren't enough — extract error info from original
    return {
      valid: false,
      error: extractJsonError(trimmed),
      corrected: corrections.length > 0,
      corrections,
    };
  }
}

function tryParse(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Replace single quotes used as JSON delimiters with double quotes.
 * Handles nested quotes carefully.
 */
function replaceSingleQuotes(input: string): string {
  let result = "";
  let inDouble = false;
  let inSingle = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const prev = i > 0 ? input[i - 1] : "";

    if (ch === '"' && !inSingle && prev !== "\\") {
      inDouble = !inDouble;
      result += ch;
    } else if (ch === "'" && !inDouble && prev !== "\\") {
      if (inSingle) {
        inSingle = false;
        result += '"';
      } else {
        inSingle = true;
        result += '"';
      }
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * Extract line/column info from a JSON parse error.
 */
function extractJsonError(input: string): JsonError {
  try {
    JSON.parse(input);
    return { message: "Unknown error" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON";

    // Try to extract position from error message
    // Chrome/V8: "at position 42"
    const posMatch = msg.match(/at position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const { line, column } = posToLineCol(input, pos);
      return { message: msg, line, column };
    }

    // Firefox: "at line X column Y"
    const lineColMatch = msg.match(/line (\d+) column (\d+)/);
    if (lineColMatch) {
      return {
        message: msg,
        line: parseInt(lineColMatch[1], 10),
        column: parseInt(lineColMatch[2], 10),
      };
    }

    return { message: msg };
  }
}

function posToLineCol(
  str: string,
  pos: number
): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < pos && i < str.length; i++) {
    if (str[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

/**
 * Get the JSON path for a given key chain.
 */
export function buildJsonPath(keys: (string | number)[]): string {
  let path = "$";
  for (const key of keys) {
    if (typeof key === "number") {
      path += `[${key}]`;
    } else if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
      path += `.${key}`;
    } else {
      path += `["${key.replace(/"/g, '\\"')}"]`;
    }
  }
  return path;
}
