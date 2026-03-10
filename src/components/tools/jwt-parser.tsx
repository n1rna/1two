"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Copy, Check, X, ClipboardPaste } from "lucide-react";
import { decodeJwt, formatTimestamp } from "@/lib/tools/jwt";

const JWT_COLORS = {
  header: "text-red-500",
  dot: "text-muted-foreground/50",
  payload: "text-purple-500",
  signature: "text-cyan-500",
};

function HighlightedToken({ token }: { token: string }) {
  const trimmed = token.trim();
  const parts = trimmed.split(".");

  if (parts.length !== 3) {
    return <span className="text-foreground break-all">{token}</span>;
  }

  return (
    <span className="break-all">
      <span className={JWT_COLORS.header}>{parts[0]}</span>
      <span className={JWT_COLORS.dot}>.</span>
      <span className={JWT_COLORS.payload}>{parts[1]}</span>
      <span className={JWT_COLORS.dot}>.</span>
      <span className={JWT_COLORS.signature}>{parts[2]}</span>
    </span>
  );
}

// Example JWT (HS256, non-secret demo token)
const EXAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiZW1haWwiOiJqYW5lQGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzE2MjM5MDIyLCJleHAiOjE3MTYzMjU0MjJ9.abc123signatureplaceholder";

export function JwtParser() {
  const [token, setToken] = useState(EXAMPLE_JWT);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const decoded = token ? decodeJwt(token) : null;

  // Auto-resize textarea to fit content
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.max(200, ta.scrollHeight) + "px";
  }, []);

  // Auto-select on mount so user can immediately paste
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      autoResize();
      ta.focus();
      ta.select();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [token]);

  const handleClear = useCallback(() => {
    setToken("");
    textareaRef.current?.focus();
  }, []);

  const handlePaste = useCallback(async () => {
    const text = await navigator.clipboard.readText();
    setToken(text);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Encoded Token</label>
          <div className="flex items-center gap-1">
            {!token && (
              <Button variant="ghost" size="sm" onClick={handlePaste} className="h-7 px-2 text-xs">
                <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
                Paste
              </Button>
            )}
            {token && (
              <>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs">
                  {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 px-2 text-xs">
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="relative rounded-lg border border-input bg-transparent">
          {/* Highlight overlay */}
          <div
            aria-hidden
            className="absolute inset-0 p-3 font-mono text-sm whitespace-pre-wrap pointer-events-none overflow-hidden"
          >
            {token ? (
              <HighlightedToken token={token} />
            ) : (
              <span className="text-muted-foreground">Paste your JWT token here...</span>
            )}
          </div>
          {/* Actual textarea — transparent text so highlight shows through */}
          <textarea
            ref={textareaRef}
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              // Defer resize so the value is committed first
              requestAnimationFrame(autoResize);
            }}
            className="relative w-full min-h-[200px] resize-none bg-transparent p-3 font-mono text-sm text-transparent caret-foreground outline-none selection:bg-primary/20"
            spellCheck={false}
          />
        </div>
        {token && decoded && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
              Header
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500" />
              Payload
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-500" />
              Signature
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4 lg:mt-9">
        {token && !decoded && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive text-sm">Invalid JWT token format</p>
            </CardContent>
          </Card>
        )}

        {decoded && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
                  Header
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="font-mono text-sm bg-muted p-4 rounded-md overflow-auto">
                  {JSON.stringify(decoded.header, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500" />
                  Payload
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <pre className="font-mono text-sm bg-muted p-4 rounded-md overflow-auto">
                  {JSON.stringify(decoded.payload, null, 2)}
                </pre>
                <Separator />
                <div className="space-y-2">
                  {Object.entries(decoded.payload).map(([key, value]) => {
                    const ts = formatTimestamp(value);
                    return (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="font-mono">{key}</Badge>
                        <span className="text-muted-foreground truncate">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </span>
                        {ts && (
                          <Badge variant="secondary" className="text-xs ml-auto shrink-0">
                            {ts}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  Signature
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-mono text-sm bg-muted p-4 rounded-md break-all whitespace-pre-wrap">
                  {decoded.signature}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Algorithm: {String(decoded.header.alg || "unknown")}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {!token && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Paste a JWT token on the left to decode its contents.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
