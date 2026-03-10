"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { encodeBase64, decodeBase64 } from "@/lib/tools/base64";

const EXAMPLE_B64 = "SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBCYXNlNjQgZXhhbXBsZS4=";
const EXAMPLE_TEXT = "Hello World! This is a Base64 example.";
const DEBOUNCE_MS = 200;

export function Base64Codec() {
  const [text, setText] = useState(EXAMPLE_TEXT);
  const [b64, setB64] = useState(EXAMPLE_B64);
  const [urlSafe, setUrlSafe] = useState(false);
  const [error, setError] = useState("");
  const [copiedText, setCopiedText] = useState(false);
  const [copiedB64, setCopiedB64] = useState(false);

  // Track which side the user is editing to avoid feedback loops
  const sourceRef = useRef<"text" | "b64" | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const b64Ref = useRef<HTMLTextAreaElement>(null);

  // Auto-select base64 input on mount
  useEffect(() => {
    b64Ref.current?.select();
  }, []);

  // Debounced encode: text → b64
  useEffect(() => {
    if (sourceRef.current !== "text") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        setB64(encodeBase64(text, urlSafe));
        setError("");
      } catch {
        setError("Failed to encode");
      }
    }, DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, urlSafe]);

  // Debounced decode: b64 → text
  useEffect(() => {
    if (sourceRef.current !== "b64") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        setText(decodeBase64(b64, urlSafe));
        setError("");
      } catch {
        setError("Invalid Base64");
      }
    }, DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [b64, urlSafe]);

  // Re-encode/decode when urlSafe changes
  useEffect(() => {
    // Default to encoding from text side
    try {
      setB64(encodeBase64(text, urlSafe));
      setError("");
    } catch {
      setError("Failed to encode");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSafe]);

  const handleTextChange = useCallback((value: string) => {
    sourceRef.current = "text";
    setText(value);
  }, []);

  const handleB64Change = useCallback((value: string) => {
    sourceRef.current = "b64";
    setB64(value);
  }, []);

  const copyText = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  }, [text]);

  const copyB64 = useCallback(async () => {
    await navigator.clipboard.writeText(b64);
    setCopiedB64(true);
    setTimeout(() => setCopiedB64(false), 2000);
  }, [b64]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          variant={urlSafe ? "default" : "outline"}
          size="sm"
          onClick={() => setUrlSafe(!urlSafe)}
        >
          URL-safe
        </Button>
        {error && (
          <span className="text-xs text-destructive">{error}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Plain Text */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Text</label>
            {text && (
              <Button variant="ghost" size="sm" onClick={copyText} className="h-7 px-2 text-xs">
                {copiedText ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copiedText ? "Copied" : "Copy"}
              </Button>
            )}
          </div>
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Type or paste plain text..."
            className="w-full min-h-[300px] resize-y rounded-lg border border-input bg-transparent p-3 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            spellCheck={false}
          />
        </div>

        {/* Right: Base64 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Base64</label>
            {b64 && (
              <Button variant="ghost" size="sm" onClick={copyB64} className="h-7 px-2 text-xs">
                {copiedB64 ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copiedB64 ? "Copied" : "Copy"}
              </Button>
            )}
          </div>
          <textarea
            ref={b64Ref}
            value={b64}
            onChange={(e) => handleB64Change(e.target.value)}
            placeholder="Type or paste Base64..."
            className="w-full min-h-[300px] resize-y rounded-lg border border-input bg-transparent p-3 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
