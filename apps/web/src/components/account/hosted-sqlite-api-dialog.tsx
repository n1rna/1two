"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Zap,
} from "lucide-react";
import type { HostedSqliteDB } from "@/lib/hosted-sqlite";

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={copy}
      title={label ?? "Copy"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function CodeBlock({
  code,
  copyLabel,
}: {
  code: string;
  copyLabel: string;
}) {
  return (
    <div className="relative rounded-md border bg-muted/40">
      <pre className="overflow-x-auto p-3 text-xs font-mono whitespace-pre">
        {code}
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton value={code} label={copyLabel} />
      </div>
    </div>
  );
}

function CollapsibleSnippet({
  label,
  code,
  copyLabel,
}: {
  label: string;
  code: string;
  copyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <button
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {label}
      </button>
      {open && <CodeBlock code={code} copyLabel={copyLabel} />}
    </div>
  );
}

export function ApiInfoDialog({
  db,
  open,
  onOpenChange,
}: {
  db: Pick<HostedSqliteDB, "id" | "name" | "apiKey" | "tursoHostname">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tokenVisible, setTokenVisible] = useState(false);

  const hostname = db.tursoHostname ?? `${db.id}.turso.io`;
  const connectionUrl = `libsql://${hostname}`;
  const token = db.apiKey ?? "";
  const maskedToken = "•".repeat(32);

  const jsSnippet = `import { createClient } from "@libsql/client";

const db = createClient({
  url: "${connectionUrl}",
  authToken: "${token || "<your-auth-token>"}",
});

const result = await db.execute("SELECT * FROM your_table LIMIT 10");
console.log(result.rows);`;

  const pythonSnippet = `import libsql_experimental as libsql

conn = libsql.connect("${hostname}", auth_token="${token || "<your-auth-token>"}")
result = conn.execute("SELECT * FROM your_table LIMIT 10")
print(result.fetchall())`;

  const goSnippet = `import "github.com/tursodatabase/libsql-client-go/libsql"

db, _ := libsql.OpenConnector("${connectionUrl}", libsql.WithAuthToken("${token || "<your-auth-token>"}"))
// Use standard database/sql interface`;

  const curlSnippet = `curl -X POST "https://${hostname}/v2/pipeline" \\
  -H "Authorization: Bearer ${token || "<your-auth-token>"}" \\
  -H "Content-Type: application/json" \\
  -d '{"requests":[{"type":"execute","stmt":{"sql":"SELECT * FROM your_table LIMIT 10"}},{"type":"close"}]}'`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4" />
            Connect — {db.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {/* Connection URL */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Connection URL
            </Label>
            <div className="flex items-center gap-1 rounded-md border bg-muted/40 px-3 py-1.5">
              <code className="flex-1 text-xs font-mono truncate">
                {connectionUrl}
              </code>
              <CopyButton value={connectionUrl} label="Copy connection URL" />
            </div>
            <p className="text-xs text-muted-foreground">
              Use this URL with any libSQL/Turso SDK.
            </p>
          </div>

          {/* Auth Token */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Auth Token</Label>
            <div className="flex items-center gap-1 rounded-md border bg-muted/40 px-3 py-1.5">
              <code className="flex-1 text-xs font-mono truncate">
                {tokenVisible && token ? token : maskedToken}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setTokenVisible((v) => !v)}
                title={tokenVisible ? "Hide token" : "Reveal token"}
                disabled={!token}
              >
                {tokenVisible ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
              {token && (
                <CopyButton value={token} label="Copy auth token" />
              )}
            </div>
            {!token && (
              <p className="text-xs text-muted-foreground">
                The auth token was only shown once at creation time.
              </p>
            )}
          </div>

          {/* SDK examples */}
          <CollapsibleSnippet
            label="JavaScript / TypeScript"
            code={jsSnippet}
            copyLabel="Copy JS/TS snippet"
          />
          <CollapsibleSnippet
            label="Python"
            code={pythonSnippet}
            copyLabel="Copy Python snippet"
          />
          <CollapsibleSnippet
            label="Go"
            code={goSnippet}
            copyLabel="Copy Go snippet"
          />
          <CollapsibleSnippet
            label="cURL (HTTP API)"
            code={curlSnippet}
            copyLabel="Copy cURL snippet"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
