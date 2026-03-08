"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Hash,
  Copy,
  Check,
  FileUp,
  X,
  Loader2,
} from "lucide-react";

const ALGORITHMS = [
  { value: "MD5", label: "MD5" },
  { value: "SHA-1", label: "SHA-1" },
  { value: "SHA-256", label: "SHA-256" },
  { value: "SHA-384", label: "SHA-384" },
  { value: "SHA-512", label: "SHA-512" },
] as const;

type Algorithm = (typeof ALGORITHMS)[number]["value"];

// ── Pure JS MD5 ──────────────────────────────────────

function md5(input: Uint8Array): string {
  const K = new Uint32Array([
    0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
    0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
    0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
    0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
    0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
    0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
    0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
    0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391,
  ]);
  const S = [
    7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
    5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
    4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
    6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21,
  ];

  const len = input.length;
  const bitLen = len * 8;
  // Padding: 1 bit + zeros + 64-bit length
  const padLen = ((56 - (len + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(len + 1 + padLen + 8);
  padded.set(input);
  padded[len] = 0x80;
  // Little-endian 64-bit length
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, bitLen >>> 0, true);
  dv.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < padded.length; offset += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = dv.getUint32(offset + j * 4, true);
    }

    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }

      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outDv = new DataView(out.buffer);
  outDv.setUint32(0, a0, true);
  outDv.setUint32(4, b0, true);
  outDv.setUint32(8, c0, true);
  outDv.setUint32(12, d0, true);
  return Array.from(out).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Hash functions ───────────────────────────────────

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashData(data: Uint8Array, algo: Algorithm): Promise<string> {
  if (algo === "MD5") return md5(data);
  return toHex(await crypto.subtle.digest(algo, data.buffer as ArrayBuffer));
}

async function hashText(text: string, algo: Algorithm): Promise<string> {
  return hashData(new TextEncoder().encode(text), algo);
}

async function hashFile(file: File, algo: Algorithm): Promise<string> {
  return hashData(new Uint8Array(await file.arrayBuffer()), algo);
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

type InputMode = "text" | "file";

export function HashTool() {
  const [mode, setMode] = useState<InputMode>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selection, setSelection] = useState<Algorithm | "ALL">("ALL");
  const [result, setResult] = useState("");
  const [allResults, setAllResults] = useState<{ algo: Algorithm; hash: string }[]>([]);
  const [computing, setComputing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const computeRef = useRef(0);

  const runHash = useCallback(async (
    inputMode: InputMode,
    inputText: string,
    inputFile: File | null,
    algo: Algorithm,
    all: boolean,
  ) => {
    if (inputMode === "text" && !inputText) {
      setResult("");
      setAllResults([]);
      return;
    }
    if (inputMode === "file" && !inputFile) {
      setResult("");
      setAllResults([]);
      return;
    }

    const id = ++computeRef.current;
    setComputing(true);
    try {
      if (all) {
        const results = await Promise.all(
          ALGORITHMS.map(async ({ value }) => ({
            algo: value,
            hash: inputMode === "text" ? await hashText(inputText, value) : await hashFile(inputFile!, value),
          }))
        );
        if (id !== computeRef.current) return;
        setAllResults(results);
        setResult(results.find((r) => r.algo === algo)?.hash || "");
      } else {
        const hash = inputMode === "text" ? await hashText(inputText, algo) : await hashFile(inputFile!, algo);
        if (id !== computeRef.current) return;
        setResult(hash);
        setAllResults([]);
      }
    } catch {
      if (id !== computeRef.current) return;
      setResult("Error computing hash");
      setAllResults([]);
    }
    if (id === computeRef.current) setComputing(false);
  }, []);

  const showAll = selection === "ALL";
  const algorithm = showAll ? "SHA-256" : selection;

  // Debounced auto-hash for text input (300ms)
  useEffect(() => {
    if (mode !== "text") return;
    const timeout = setTimeout(() => {
      runHash(mode, text, null, algorithm, showAll);
    }, 300);
    return () => clearTimeout(timeout);
  }, [text, selection, mode, runHash]); // eslint-disable-line react-hooks/exhaustive-deps

  // Immediate hash for file input
  useEffect(() => {
    if (mode !== "file") return;
    runHash(mode, "", file, algorithm, showAll);
  }, [file, selection, mode, runHash]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyHash = useCallback(async (hash: string, key: string) => {
    await navigator.clipboard.writeText(hash);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setResult("");
    setAllResults([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="border-b shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Hash</span>
          {computing && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          {/* Input mode + algorithm */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 border rounded-lg p-0.5">
              {(["text", "file"] as InputMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    mode === m
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "text" ? "Text" : "File"}
                </button>
              ))}
            </div>

            <Select value={selection} onValueChange={(v) => setSelection(v as Algorithm | "ALL")}>
              <SelectTrigger size="sm" className="w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Algorithms</SelectItem>
                {ALGORITHMS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Text input */}
          {mode === "text" && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text to hash..."
              className="w-full h-40 px-3 py-2 text-sm rounded-lg border bg-transparent font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
            />
          )}

          {/* File input */}
          {mode === "file" && (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-muted/20">
                  <FileUp className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)} · {file.type || "unknown type"}
                    </p>
                  </div>
                  <button onClick={clearFile} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 px-4 py-8 rounded-lg border-2 border-dashed text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <FileUp className="h-8 w-8" />
                  <span className="text-sm">Click to select a file</span>
                </button>
              )}
            </div>
          )}

          {/* Single result */}
          {result && !showAll && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{algorithm}</span>
                <button
                  onClick={() => copyHash(result, "single")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  {copied === "single" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied === "single" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="px-3 py-2.5 rounded-lg border bg-muted/20 font-mono text-sm break-all select-all">
                {result}
              </div>
            </div>
          )}

          {/* All results */}
          {allResults.length > 0 && (
            <div className="space-y-2">
              {allResults.map(({ algo, hash }) => (
                <div key={algo} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{algo}</span>
                    <button
                      onClick={() => copyHash(hash, algo)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      {copied === algo ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied === algo ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="px-3 py-2 rounded-lg border bg-muted/20 font-mono text-sm break-all select-all">
                    {hash}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
