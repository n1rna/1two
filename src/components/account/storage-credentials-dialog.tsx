"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  HardDrive,
  Loader2,
} from "lucide-react";
import { getBucketCredentials, type BucketCredentials } from "@/lib/storage";

export function StorageCredentialsDialog({
  bucketId,
  bucketName,
  open,
  onOpenChange,
}: {
  bucketId: string;
  bucketName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [creds, setCreds] = useState<BucketCredentials | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secretRevealed, setSecretRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadCreds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCreds(await getBucketCredentials(bucketId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [bucketId]);

  useEffect(() => {
    if (open) {
      setSecretRevealed(false);
      setCopiedField(null);
      loadCreds();
    } else {
      setCreds(null);
    }
  }, [open, loadCreds]);

  const copyValue = async (value: string, field: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const fields: { label: string; value: string; key: string; secret?: boolean }[] = creds
    ? [
        { label: "S3 Endpoint", value: creds.endpoint, key: "endpoint" },
        { label: "Bucket Name", value: creds.bucketName, key: "bucketName" },
        { label: "Region", value: creds.region, key: "region" },
        { label: "Access Key ID", value: creds.accessKeyId, key: "accessKeyId" },
        { label: "Secret Access Key", value: creds.secretAccessKey, key: "secretAccessKey", secret: true },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            S3 Credentials — {bucketName}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive py-4">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && creds && (
          <div className="space-y-4 min-w-0 overflow-hidden">
            {/* Fields */}
            <div className="rounded-md border divide-y min-w-0 overflow-hidden">
              {fields.map((f) => (
                <div
                  key={f.key}
                  className="flex items-center gap-3 px-3 py-2 text-xs min-w-0"
                >
                  <span className="w-32 shrink-0 text-muted-foreground font-medium">
                    {f.label}
                  </span>
                  <code className="flex-1 min-w-0 font-mono text-foreground truncate select-all">
                    {f.secret && !secretRevealed ? "••••••••••••••••" : f.value}
                  </code>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {f.secret && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setSecretRevealed((v) => !v)}
                        title={secretRevealed ? "Hide" : "Show"}
                      >
                        {secretRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyValue(f.value, f.key)}
                      title={`Copy ${f.label.toLowerCase()}`}
                    >
                      {copiedField === f.key ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* AWS CLI example */}
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-medium text-muted-foreground">
                AWS CLI example
              </label>
              <div className="flex items-start gap-1.5 min-w-0">
                <pre className="flex-1 min-w-0 rounded-md border bg-muted/40 px-3 py-2 text-[11px] font-mono break-all leading-relaxed select-all overflow-x-auto whitespace-pre-wrap">
{`aws s3 ls s3://${creds.bucketName}/ \\
  --endpoint-url ${creds.endpoint} \\
  --region auto`}
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 mt-0.5"
                  onClick={() =>
                    copyValue(
                      `aws s3 ls s3://${creds.bucketName}/ --endpoint-url ${creds.endpoint} --region auto`,
                      "cli"
                    )
                  }
                  title="Copy AWS CLI command"
                >
                  {copiedField === "cli" ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/60">
                Configure credentials with{" "}
                <code className="font-mono bg-muted px-1 rounded">aws configure</code> or{" "}
                <code className="font-mono bg-muted px-1 rounded">AWS_ACCESS_KEY_ID</code> /{" "}
                <code className="font-mono bg-muted px-1 rounded">AWS_SECRET_ACCESS_KEY</code> environment variables.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
