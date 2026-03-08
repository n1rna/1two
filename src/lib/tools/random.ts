export type GeneratorType =
  | "uuid"
  | "password"
  | "secret"
  | "hex"
  | "base64"
  | "number"
  | "lorem";

export interface GeneratorConfig {
  // UUID
  uuidVersion: "v4" | "v7";
  // Password
  passwordLength: number;
  passwordUppercase: boolean;
  passwordLowercase: boolean;
  passwordDigits: boolean;
  passwordSymbols: boolean;
  passwordExclude: string;
  // Secret
  secretLength: number;
  secretFormat: "hex" | "base64" | "base64url";
  // Hex
  hexLength: number;
  // Base64
  base64ByteLength: number;
  // Number
  numberMin: number;
  numberMax: number;
  // Lorem
  loremUnit: "words" | "sentences" | "paragraphs";
  loremCount: number;
}

export const DEFAULT_CONFIG: GeneratorConfig = {
  uuidVersion: "v4",
  passwordLength: 20,
  passwordUppercase: true,
  passwordLowercase: true,
  passwordDigits: true,
  passwordSymbols: true,
  passwordExclude: "",
  secretLength: 32,
  secretFormat: "hex",
  hexLength: 32,
  base64ByteLength: 32,
  numberMin: 0,
  numberMax: 1000000,
  loremUnit: "paragraphs",
  loremCount: 3,
};

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}|;:,.<>?";

export function generateUUID(version: "v4" | "v7"): string {
  if (version === "v7") {
    return uuidV7();
  }
  return uuidV4();
}

function uuidV4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  return formatUUID(bytes);
}

function uuidV7(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const now = Date.now();
  // 48-bit timestamp
  bytes[0] = (now / 2 ** 40) & 0xff;
  bytes[1] = (now / 2 ** 32) & 0xff;
  bytes[2] = (now / 2 ** 24) & 0xff;
  bytes[3] = (now / 2 ** 16) & 0xff;
  bytes[4] = (now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  return formatUUID(bytes);
}

function formatUUID(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generatePassword(config: GeneratorConfig): string {
  let charset = "";
  if (config.passwordUppercase) charset += UPPER;
  if (config.passwordLowercase) charset += LOWER;
  if (config.passwordDigits) charset += DIGITS;
  if (config.passwordSymbols) charset += SYMBOLS;

  if (config.passwordExclude) {
    const excluded = new Set(config.passwordExclude);
    charset = charset
      .split("")
      .filter((c) => !excluded.has(c))
      .join("");
  }

  if (!charset) return "";

  const bytes = new Uint8Array(config.passwordLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => charset[b % charset.length])
    .join("");
}

export function generateSecret(config: GeneratorConfig): string {
  const bytes = new Uint8Array(config.secretLength);
  crypto.getRandomValues(bytes);

  switch (config.secretFormat) {
    case "hex":
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    case "base64":
      return btoa(String.fromCharCode(...bytes));
    case "base64url":
      return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
  }
}

export function generateHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

export function generateBase64(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function generateNumber(min: number, max: number): string {
  if (min >= max) return String(min);
  const range = max - min + 1;
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const val = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(min + (val % range));
}

const LOREM_WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
  "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint",
  "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia",
  "deserunt", "mollit", "anim", "id", "est", "laborum", "at", "vero", "eos",
  "accusamus", "iusto", "odio", "dignissimos", "ducimus", "blanditiis",
  "praesentium", "voluptatum", "deleniti", "atque", "corrupti", "quos", "dolores",
  "quas", "molestias", "excepturi", "obcaecati", "cupiditate", "provident",
  "similique", "mollitia", "animi", "perspiciatis", "unde", "omnis", "iste",
  "natus", "error", "voluptatem", "accusantium", "doloremque", "laudantium",
  "totam", "rem", "aperiam", "eaque", "ipsa", "quae", "ab", "illo", "inventore",
  "veritatis", "quasi", "architecto", "beatae", "vitae", "dicta", "explicabo",
  "nemo", "ipsam", "voluptas", "aspernatur", "aut", "odit", "fugit",
  "consequuntur", "magni", "dolorem", "numquam", "eius", "modi", "tempora",
  "magnam", "aliquam", "quaerat", "minima", "nostrum", "exercitationem",
  "ullam", "corporis", "suscipit", "laboriosam", "nihil", "impedit", "quo",
  "minus", "maxime", "placeat", "facere", "possimus", "assumenda",
  "repellendus", "temporibus", "quibusdam", "illum", "soluta", "nobis",
  "eligendi", "optio", "cumque", "vel", "necessitatibus", "saepe", "eveniet",
  "autem", "recusandae",
];

function pickRandomWord(): string {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  return LOREM_WORDS[bytes[0] % LOREM_WORDS.length];
}

function generateLoremWords(count: number): string {
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    words.push(pickRandomWord());
  }
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

function generateLoremSentence(): string {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  const wordCount = 6 + (bytes[0] % 12); // 6-17 words
  return generateLoremWords(wordCount) + ".";
}

function generateLoremParagraph(): string {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  const sentenceCount = 3 + (bytes[0] % 5); // 3-7 sentences
  const sentences: string[] = [];
  for (let i = 0; i < sentenceCount; i++) {
    sentences.push(generateLoremSentence());
  }
  return sentences.join(" ");
}

export function generateLorem(config: GeneratorConfig): string {
  switch (config.loremUnit) {
    case "words":
      return generateLoremWords(config.loremCount);
    case "sentences": {
      const sentences: string[] = [];
      for (let i = 0; i < config.loremCount; i++) {
        sentences.push(generateLoremSentence());
      }
      return sentences.join(" ");
    }
    case "paragraphs": {
      const paragraphs: string[] = [];
      for (let i = 0; i < config.loremCount; i++) {
        paragraphs.push(generateLoremParagraph());
      }
      return paragraphs.join("\n\n");
    }
  }
}

export function generate(type: GeneratorType, config: GeneratorConfig): string {
  switch (type) {
    case "uuid":
      return generateUUID(config.uuidVersion);
    case "password":
      return generatePassword(config);
    case "secret":
      return generateSecret(config);
    case "hex":
      return generateHex(config.hexLength);
    case "base64":
      return generateBase64(config.base64ByteLength);
    case "number":
      return generateNumber(config.numberMin, config.numberMax);
    case "lorem":
      return generateLorem(config);
  }
}

export const GENERATOR_INFO: Record<
  GeneratorType,
  { label: string; description: string }
> = {
  uuid: { label: "UUID", description: "Universally unique identifier" },
  password: { label: "Password", description: "Random password with character options" },
  secret: { label: "Secret Key", description: "Cryptographic random bytes" },
  hex: { label: "Hex String", description: "Random hexadecimal string" },
  base64: { label: "Base64", description: "Random Base64-encoded bytes" },
  number: { label: "Number", description: "Random integer in range" },
  lorem: { label: "Lorem Ipsum", description: "Random placeholder text" },
};

export const GENERATOR_TYPES: GeneratorType[] = [
  "uuid",
  "password",
  "secret",
  "hex",
  "base64",
  "number",
  "lorem",
];
