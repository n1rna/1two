"use client";

import { useState, useEffect, use } from "react";
import { Loader2, ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { useSession, signIn } from "@/lib/auth-client";
import { MarkdownEditor } from "@/components/tools/markdown-editor";
import { Button } from "@/components/ui/button";
import { Github, Chrome } from "lucide-react";

interface PasteData {
  id: string;
  userId?: string;
  title: string;
  content: string;
  format: string;
}

export default function MarkdownEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, isPending: sessionPending } = useSession();
  const [paste, setPaste] = useState<PasteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    async function fetchPaste() {
      try {
        const res = await fetch(`/api/proxy/pastes/${id}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setPaste(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchPaste();
  }, [id]);

  // Check ownership once both paste and session are loaded
  useEffect(() => {
    if (loading || sessionPending) return;
    if (paste && (!session?.user?.id || session.user.id !== paste.userId)) {
      setUnauthorized(true);
    }
  }, [loading, sessionPending, paste, session]);

  if (loading || sessionPending) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Page not found</p>
          <p className="text-sm text-muted-foreground">
            This page may have been deleted or the link is incorrect.
          </p>
        </div>
        <Link
          href="/tools/markdown"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Go to Markdown Editor
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-lg max-w-sm text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Sign in required</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Sign in to edit this page.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => signIn.social({ provider: "github", callbackURL: window.location.href })}
            >
              <Github className="h-4 w-4" />
              Continue with GitHub
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => signIn.social({ provider: "google", callbackURL: window.location.href })}
            >
              <Chrome className="h-4 w-4" />
              Continue with Google
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Not authorized</p>
          <p className="text-sm text-muted-foreground">
            You can only edit pages you own.
          </p>
        </div>
        <Link
          href={`/p/${id}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          View this page
        </Link>
      </div>
    );
  }

  if (!paste) return null;

  return (
    <>
      <style>{`body { overflow: hidden; }`}</style>
      <MarkdownEditor
        pasteId={paste.id}
        initialContent={paste.content}
        initialTitle={paste.title}
      />
    </>
  );
}
