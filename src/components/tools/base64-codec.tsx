"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, X, ClipboardPaste, ArrowDownUp } from "lucide-react";
import { encodeBase64, decodeBase64 } from "@/lib/tools/base64";

export function Base64Codec() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("decode");
  const [urlSafe, setUrlSafe] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function process(text: string, m: "encode" | "decode") {
    try {
      if (m === "encode") {
        setOutput(encodeBase64(text, urlSafe));
      } else {
        setOutput(decodeBase64(text, urlSafe));
      }
      setError("");
    } catch {
      setError(`Failed to ${m}. Check your input.`);
      setOutput("");
    }
  }

  const handleProcess = useCallback(() => {
    process(input, mode);
  }, [input, mode, urlSafe]);

  const handleSwap = useCallback(() => {
    const newMode = mode === "encode" ? "decode" : "encode";
    setMode(newMode);
    setInput(output);
    setOutput("");
    setError("");
  }, [mode, output]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleClear = useCallback(() => {
    setInput("");
    setOutput("");
    setError("");
    inputRef.current?.focus();
  }, []);

  const handlePaste = useCallback(async () => {
    const text = await navigator.clipboard.readText();
    setInput(text);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {mode === "decode" ? "Base64 Input" : "Text Input"}
          </label>
          <div className="flex items-center gap-1">
            {!input && (
              <Button variant="ghost" size="sm" onClick={handlePaste} className="h-7 px-2 text-xs">
                <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
                Paste
              </Button>
            )}
            {input && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 px-2 text-xs">
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "decode" ? "Paste Base64 string..." : "Enter text to encode..."}
          className="w-full min-h-[300px] resize-y rounded-lg border border-input bg-transparent p-3 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          spellCheck={false}
        />

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Tabs value={mode} onValueChange={(v) => { setMode(v as "encode" | "decode"); setError(""); }}>
            <TabsList>
              <TabsTrigger value="decode">Decode</TabsTrigger>
              <TabsTrigger value="encode">Encode</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant={urlSafe ? "default" : "outline"}
            size="sm"
            onClick={() => setUrlSafe(!urlSafe)}
          >
            URL-safe
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleProcess}>
            {mode === "decode" ? "Decode" : "Encode"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleSwap} disabled={!output}>
            <ArrowDownUp className="h-3.5 w-3.5 mr-1.5" />
            Swap
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-4 pb-3">
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: Output */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mt-2">
          <label className="text-sm font-medium">
            {mode === "decode" ? "Decoded Text" : "Base64 Output"}
          </label>
          {output && (
            <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs">
              {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
        </div>
        <textarea
          value={output}
          readOnly
          placeholder="Output will appear here..."
          className="w-full min-h-[300px] resize-y rounded-lg border border-input bg-transparent p-3 font-mono text-sm outline-none placeholder:text-muted-foreground"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
