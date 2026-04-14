export type KeyboardSize = "60" | "65" | "75" | "tkl" | "full";
export type KeyboardLayout = "qwerty" | "azerty" | "dvorak" | "colemak";
export type HighlightMode = "all" | "last";

export interface KeyDef {
  code: string;
  label: string;
  width: number; // in key units (1 = standard key)
  gap?: number; // gap before this key in units
}

export interface KeyboardConfig {
  size: KeyboardSize;
  layout: KeyboardLayout;
  split: boolean;
}

export const SIZE_LABELS: Record<KeyboardSize, string> = {
  "60": "60%",
  "65": "65%",
  "75": "75%",
  tkl: "TKL (80%)",
  full: "Full (100%)",
};

export const LAYOUT_LABELS: Record<KeyboardLayout, string> = {
  qwerty: "QWERTY",
  azerty: "AZERTY",
  dvorak: "Dvorak",
  colemak: "Colemak",
};

// Alpha key remapping per layout
const LAYOUT_MAP: Record<KeyboardLayout, Record<string, string>> = {
  qwerty: {},
  azerty: {
    KeyQ: "A", KeyW: "Z", KeyA: "Q", KeyZ: "W",
    KeyM: ",", Comma: ";", Period: ":", Slash: "!",
    Semicolon: "M", Quote: "ù", BracketLeft: "^", BracketRight: "$",
    Digit1: "&", Digit2: "é", Digit3: '"', Digit4: "'",
    Digit5: "(", Digit6: "-", Digit7: "è", Digit8: "_",
    Digit9: "ç", Digit0: "à", Minus: ")", Equal: "=",
  },
  dvorak: {
    KeyQ: "'", KeyW: ",", KeyE: ".", KeyR: "P", KeyT: "Y",
    KeyY: "F", KeyU: "G", KeyI: "C", KeyO: "R", KeyP: "L",
    BracketLeft: "/", BracketRight: "=",
    KeyA: "A", KeyS: "O", KeyD: "E", KeyF: "U", KeyG: "I",
    KeyH: "D", KeyJ: "H", KeyK: "T", KeyL: "N", Semicolon: "S",
    Quote: "-",
    KeyZ: ";", KeyX: "Q", KeyC: "J", KeyV: "K", KeyB: "X",
    KeyN: "B", KeyM: "M", Comma: "W", Period: "V", Slash: "Z",
    Minus: "[", Equal: "]",
  },
  colemak: {
    KeyE: "F", KeyR: "P", KeyT: "G", KeyY: "J", KeyU: "L",
    KeyI: "U", KeyO: "Y", KeyP: ";",
    KeyS: "R", KeyD: "S", KeyF: "T", KeyG: "D",
    KeyJ: "N", KeyK: "E", KeyL: "I", Semicolon: "O",
    KeyN: "K",
  },
};

// Base QWERTY rows
const ESC_ROW: KeyDef[] = [
  { code: "Escape", label: "Esc", width: 1 },
];

const FUNCTION_ROW: KeyDef[] = [
  { code: "F1", label: "F1", width: 1, gap: 0.5 },
  { code: "F2", label: "F2", width: 1 },
  { code: "F3", label: "F3", width: 1 },
  { code: "F4", label: "F4", width: 1 },
  { code: "F5", label: "F5", width: 1, gap: 0.25 },
  { code: "F6", label: "F6", width: 1 },
  { code: "F7", label: "F7", width: 1 },
  { code: "F8", label: "F8", width: 1 },
  { code: "F9", label: "F9", width: 1, gap: 0.25 },
  { code: "F10", label: "F10", width: 1 },
  { code: "F11", label: "F11", width: 1 },
  { code: "F12", label: "F12", width: 1 },
];

const NUMBER_ROW: KeyDef[] = [
  { code: "Backquote", label: "`", width: 1 },
  { code: "Digit1", label: "1", width: 1 },
  { code: "Digit2", label: "2", width: 1 },
  { code: "Digit3", label: "3", width: 1 },
  { code: "Digit4", label: "4", width: 1 },
  { code: "Digit5", label: "5", width: 1 },
  { code: "Digit6", label: "6", width: 1 },
  { code: "Digit7", label: "7", width: 1 },
  { code: "Digit8", label: "8", width: 1 },
  { code: "Digit9", label: "9", width: 1 },
  { code: "Digit0", label: "0", width: 1 },
  { code: "Minus", label: "-", width: 1 },
  { code: "Equal", label: "=", width: 1 },
  { code: "Backspace", label: "⌫", width: 2 },
];

const QWERTY_ROW: KeyDef[] = [
  { code: "Tab", label: "Tab", width: 1.5 },
  { code: "KeyQ", label: "Q", width: 1 },
  { code: "KeyW", label: "W", width: 1 },
  { code: "KeyE", label: "E", width: 1 },
  { code: "KeyR", label: "R", width: 1 },
  { code: "KeyT", label: "T", width: 1 },
  { code: "KeyY", label: "Y", width: 1 },
  { code: "KeyU", label: "U", width: 1 },
  { code: "KeyI", label: "I", width: 1 },
  { code: "KeyO", label: "O", width: 1 },
  { code: "KeyP", label: "P", width: 1 },
  { code: "BracketLeft", label: "[", width: 1 },
  { code: "BracketRight", label: "]", width: 1 },
  { code: "Backslash", label: "\\", width: 1.5 },
];

const HOME_ROW: KeyDef[] = [
  { code: "CapsLock", label: "Caps", width: 1.75 },
  { code: "KeyA", label: "A", width: 1 },
  { code: "KeyS", label: "S", width: 1 },
  { code: "KeyD", label: "D", width: 1 },
  { code: "KeyF", label: "F", width: 1 },
  { code: "KeyG", label: "G", width: 1 },
  { code: "KeyH", label: "H", width: 1 },
  { code: "KeyJ", label: "J", width: 1 },
  { code: "KeyK", label: "K", width: 1 },
  { code: "KeyL", label: "L", width: 1 },
  { code: "Semicolon", label: ";", width: 1 },
  { code: "Quote", label: "'", width: 1 },
  { code: "Enter", label: "Enter", width: 2.25 },
];

const BOTTOM_ROW: KeyDef[] = [
  { code: "ShiftLeft", label: "Shift", width: 2.25 },
  { code: "KeyZ", label: "Z", width: 1 },
  { code: "KeyX", label: "X", width: 1 },
  { code: "KeyC", label: "C", width: 1 },
  { code: "KeyV", label: "V", width: 1 },
  { code: "KeyB", label: "B", width: 1 },
  { code: "KeyN", label: "N", width: 1 },
  { code: "KeyM", label: "M", width: 1 },
  { code: "Comma", label: ",", width: 1 },
  { code: "Period", label: ".", width: 1 },
  { code: "Slash", label: "/", width: 1 },
  { code: "ShiftRight", label: "Shift", width: 2.75 },
];

const SPACE_ROW_60: KeyDef[] = [
  { code: "ControlLeft", label: "Ctrl", width: 1.25 },
  { code: "MetaLeft", label: "⌘", width: 1.25 },
  { code: "AltLeft", label: "Alt", width: 1.25 },
  { code: "Space", label: "", width: 6.25 },
  { code: "AltRight", label: "Alt", width: 1.25 },
  { code: "MetaRight", label: "⌘", width: 1.25 },
  { code: "ContextMenu", label: "Menu", width: 1.25 },
  { code: "ControlRight", label: "Ctrl", width: 1.25 },
];

// Navigation cluster
const NAV_COL_1: KeyDef[] = [
  { code: "Insert", label: "Ins", width: 1 },
  { code: "Home", label: "Home", width: 1 },
  { code: "PageUp", label: "PgUp", width: 1 },
];

const NAV_COL_2: KeyDef[] = [
  { code: "Delete", label: "Del", width: 1 },
  { code: "End", label: "End", width: 1 },
  { code: "PageDown", label: "PgDn", width: 1 },
];

// Arrow keys
const ARROW_UP: KeyDef = { code: "ArrowUp", label: "↑", width: 1 };
const ARROW_LEFT: KeyDef = { code: "ArrowLeft", label: "←", width: 1 };
const ARROW_DOWN: KeyDef = { code: "ArrowDown", label: "↓", width: 1 };
const ARROW_RIGHT: KeyDef = { code: "ArrowRight", label: "→", width: 1 };

// Numpad
const NUMPAD_ROWS: KeyDef[][] = [
  [
    { code: "NumLock", label: "Num", width: 1 },
    { code: "NumpadDivide", label: "/", width: 1 },
    { code: "NumpadMultiply", label: "*", width: 1 },
    { code: "NumpadSubtract", label: "-", width: 1 },
  ],
  [
    { code: "Numpad7", label: "7", width: 1 },
    { code: "Numpad8", label: "8", width: 1 },
    { code: "Numpad9", label: "9", width: 1 },
    { code: "NumpadAdd", label: "+", width: 1 },
  ],
  [
    { code: "Numpad4", label: "4", width: 1 },
    { code: "Numpad5", label: "5", width: 1 },
    { code: "Numpad6", label: "6", width: 1 },
  ],
  [
    { code: "Numpad1", label: "1", width: 1 },
    { code: "Numpad2", label: "2", width: 1 },
    { code: "Numpad3", label: "3", width: 1 },
    { code: "NumpadEnter", label: "⏎", width: 1 },
  ],
  [
    { code: "Numpad0", label: "0", width: 2 },
    { code: "NumpadDecimal", label: ".", width: 1 },
  ],
];

// 65% adds arrows and a few nav keys to the right
const BOTTOM_ROW_65: KeyDef[] = [
  ...BOTTOM_ROW.slice(0, -1),
  { code: "ShiftRight", label: "Shift", width: 1.75 },
  { code: "ArrowUp", label: "↑", width: 1 },
];

const SPACE_ROW_65: KeyDef[] = [
  { code: "ControlLeft", label: "Ctrl", width: 1.25 },
  { code: "MetaLeft", label: "⌘", width: 1.25 },
  { code: "AltLeft", label: "Alt", width: 1.25 },
  { code: "Space", label: "", width: 6.25 },
  { code: "AltRight", label: "Alt", width: 1 },
  { code: "ControlRight", label: "Ctrl", width: 1 },
  { code: "ArrowLeft", label: "←", width: 1 },
  { code: "ArrowDown", label: "↓", width: 1 },
  { code: "ArrowRight", label: "→", width: 1 },
];

export type KeyRow = KeyDef[];

export interface KeyboardRows {
  rows: KeyRow[];
  // For numpad and nav cluster, rendered as separate blocks
  navCluster?: KeyRow[];
  arrowCluster?: KeyRow[];
  numpad?: KeyRow[];
}

export function getKeyboardRows(size: KeyboardSize): KeyboardRows {
  switch (size) {
    case "60":
      return {
        rows: [NUMBER_ROW, QWERTY_ROW, HOME_ROW, BOTTOM_ROW, SPACE_ROW_60],
      };

    case "65":
      return {
        rows: [
          [...NUMBER_ROW, { code: "Delete", label: "Del", width: 1, gap: 0 }],
          [...QWERTY_ROW, { code: "PageUp", label: "PgUp", width: 1 }],
          [...HOME_ROW, { code: "PageDown", label: "PgDn", width: 1 }],
          BOTTOM_ROW_65,
          SPACE_ROW_65,
        ],
      };

    case "75":
      return {
        rows: [
          [...ESC_ROW, ...FUNCTION_ROW, { code: "Delete", label: "Del", width: 1, gap: 0.25 }],
          [...NUMBER_ROW, { code: "Home", label: "Home", width: 1, gap: 0 }],
          [...QWERTY_ROW, { code: "PageUp", label: "PgUp", width: 1 }],
          [...HOME_ROW, { code: "PageDown", label: "PgDn", width: 1 }],
          BOTTOM_ROW_65,
          SPACE_ROW_65,
        ],
      };

    case "tkl":
      return {
        rows: [
          [...ESC_ROW, ...FUNCTION_ROW],
          NUMBER_ROW,
          QWERTY_ROW,
          HOME_ROW,
          BOTTOM_ROW,
          SPACE_ROW_60,
        ],
        navCluster: [
          NAV_COL_1,
          NAV_COL_2,
        ],
        arrowCluster: [
          [ARROW_UP],
          [ARROW_LEFT, ARROW_DOWN, ARROW_RIGHT],
        ],
      };

    case "full":
      return {
        rows: [
          [...ESC_ROW, ...FUNCTION_ROW],
          NUMBER_ROW,
          QWERTY_ROW,
          HOME_ROW,
          BOTTOM_ROW,
          SPACE_ROW_60,
        ],
        navCluster: [
          NAV_COL_1,
          NAV_COL_2,
        ],
        arrowCluster: [
          [ARROW_UP],
          [ARROW_LEFT, ARROW_DOWN, ARROW_RIGHT],
        ],
        numpad: NUMPAD_ROWS,
      };
  }
}

/** Collect all key codes visible in the current keyboard config */
export function collectVisibleCodes(kb: KeyboardRows): Set<string> {
  const codes = new Set<string>();
  const add = (rows: KeyRow[]) => rows.forEach((r) => r.forEach((k) => codes.add(k.code)));
  add(kb.rows);
  if (kb.navCluster) add(kb.navCluster);
  if (kb.arrowCluster) add(kb.arrowCluster);
  if (kb.numpad) add(kb.numpad);
  return codes;
}

/** Friendly label for any key code */
export const KEY_CODE_LABELS: Record<string, string> = {
  // Function keys
  Escape: "Esc", F1: "F1", F2: "F2", F3: "F3", F4: "F4", F5: "F5", F6: "F6",
  F7: "F7", F8: "F8", F9: "F9", F10: "F10", F11: "F11", F12: "F12",
  F13: "F13", F14: "F14", F15: "F15", F16: "F16", F17: "F17", F18: "F18",
  F19: "F19", F20: "F20", F21: "F21", F22: "F22", F23: "F23", F24: "F24",
  // Number row
  Backquote: "`", Digit1: "1", Digit2: "2", Digit3: "3", Digit4: "4",
  Digit5: "5", Digit6: "6", Digit7: "7", Digit8: "8", Digit9: "9", Digit0: "0",
  Minus: "-", Equal: "=", Backspace: "⌫",
  // QWERTY row
  Tab: "Tab", KeyQ: "Q", KeyW: "W", KeyE: "E", KeyR: "R", KeyT: "T",
  KeyY: "Y", KeyU: "U", KeyI: "I", KeyO: "O", KeyP: "P",
  BracketLeft: "[", BracketRight: "]", Backslash: "\\",
  // Home row
  CapsLock: "Caps", KeyA: "A", KeyS: "S", KeyD: "D", KeyF: "F", KeyG: "G",
  KeyH: "H", KeyJ: "J", KeyK: "K", KeyL: "L", Semicolon: ";", Quote: "'", Enter: "Enter",
  // Bottom row
  ShiftLeft: "LShift", KeyZ: "Z", KeyX: "X", KeyC: "C", KeyV: "V", KeyB: "B",
  KeyN: "N", KeyM: "M", Comma: ",", Period: ".", Slash: "/", ShiftRight: "RShift",
  // Space row
  ControlLeft: "LCtrl", MetaLeft: "⌘", AltLeft: "LAlt", Space: "Space",
  AltRight: "RAlt", MetaRight: "⌘R", ContextMenu: "Menu", ControlRight: "RCtrl",
  // Nav
  PrintScreen: "PrtSc", ScrollLock: "ScrLk", Pause: "Pause",
  Insert: "Ins", Home: "Home", PageUp: "PgUp",
  Delete: "Del", End: "End", PageDown: "PgDn",
  // Arrows
  ArrowUp: "↑", ArrowLeft: "←", ArrowDown: "↓", ArrowRight: "→",
  // Numpad
  NumLock: "NumLk", NumpadDivide: "N/", NumpadMultiply: "N*", NumpadSubtract: "N-",
  Numpad7: "N7", Numpad8: "N8", Numpad9: "N9", NumpadAdd: "N+",
  Numpad4: "N4", Numpad5: "N5", Numpad6: "N6",
  Numpad1: "N1", Numpad2: "N2", Numpad3: "N3", NumpadEnter: "N⏎",
  Numpad0: "N0", NumpadDecimal: "N.",
  // Media / special
  AudioVolumeMute: "Mute", AudioVolumeDown: "Vol-", AudioVolumeUp: "Vol+",
  MediaTrackPrevious: "Prev", MediaTrackNext: "Next",
  MediaPlayPause: "Play", MediaStop: "Stop",
  LaunchMail: "Mail", LaunchApp1: "App1", LaunchApp2: "App2",
  BrowserBack: "Back", BrowserForward: "Fwd", BrowserRefresh: "Refresh",
  BrowserSearch: "Search", BrowserFavorites: "Favs", BrowserHome: "Home",
  IntlBackslash: "\\", IntlRo: "Ro", IntlYen: "¥",
  Lang1: "Lang1", Lang2: "Lang2",
  Convert: "Conv", NonConvert: "NConv", KanaMode: "Kana",
  Power: "Power", Sleep: "Sleep", WakeUp: "Wake",
};

export function getKeyLabel(code: string): string {
  return KEY_CODE_LABELS[code] || code.replace(/^(Key|Digit|Numpad)/, "");
}

// ── Layout Detection ──────────────────────────────────

/** Keys we ask the user to press for detection, in order. */
export const DETECT_KEYS: { code: string; prompt: string }[] = [
  { code: "KeyQ", prompt: "the key to the right of Tab" },
  { code: "KeyW", prompt: "the key 2nd right of Tab" },
  { code: "KeyA", prompt: "the key to the right of Caps Lock" },
  { code: "Semicolon", prompt: "the key 2 right of L" },
  { code: "KeyZ", prompt: "the key to the right of Left Shift" },
  { code: "KeyM", prompt: "the key 7th right of Left Shift" },
];

/** What character each layout produces for a given physical code */
const LAYOUT_FINGERPRINTS: Record<KeyboardLayout, Record<string, string>> = {
  qwerty: { KeyQ: "q", KeyW: "w", KeyA: "a", Semicolon: ";", KeyZ: "z", KeyM: "m" },
  azerty: { KeyQ: "a", KeyW: "z", KeyA: "q", Semicolon: "m", KeyZ: "w", KeyM: "," },
  dvorak: { KeyQ: "'", KeyW: ",", KeyA: "a", Semicolon: "s", KeyZ: ";", KeyM: "m" },
  colemak: { KeyQ: "q", KeyW: "w", KeyA: "a", Semicolon: "o", KeyZ: "z", KeyM: "m" },
};

export interface DetectResult {
  layout: KeyboardLayout;
  confidence: number; // 0-1
}

/** Given a map of code→key from user presses, score each layout */
export function detectLayout(
  samples: Record<string, string>
): DetectResult[] {
  const layouts = Object.keys(LAYOUT_FINGERPRINTS) as KeyboardLayout[];
  const results: DetectResult[] = layouts.map((layout) => {
    const fp = LAYOUT_FINGERPRINTS[layout];
    let matches = 0;
    let total = 0;
    for (const code of Object.keys(samples)) {
      if (fp[code] !== undefined) {
        total++;
        if (samples[code].toLowerCase() === fp[code]) matches++;
      }
    }
    return { layout, confidence: total > 0 ? matches / total : 0 };
  });
  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}

export function applyLayout(rows: KeyRow[], layout: KeyboardLayout): KeyRow[] {
  const map = LAYOUT_MAP[layout];
  if (!map || Object.keys(map).length === 0) return rows;
  return rows.map((row) =>
    row.map((key) => {
      const mapped = map[key.code];
      return mapped ? { ...key, label: mapped } : key;
    })
  );
}

export function applySplit(rows: KeyRow[]): KeyRow[] {
  return rows.map((row) => {
    // Find the approximate middle and insert a gap
    let totalWidth = 0;
    for (const k of row) {
      totalWidth += k.width + (k.gap || 0);
    }
    const half = totalWidth / 2;
    let acc = 0;
    let splitIdx = 0;
    for (let i = 0; i < row.length; i++) {
      acc += row[i].width + (row[i].gap || 0);
      if (acc >= half) {
        splitIdx = i + 1;
        break;
      }
    }
    if (splitIdx > 0 && splitIdx < row.length) {
      const newRow = [...row];
      newRow[splitIdx] = { ...newRow[splitIdx], gap: (newRow[splitIdx].gap || 0) + 0.75 };
      return newRow;
    }
    return row;
  });
}
