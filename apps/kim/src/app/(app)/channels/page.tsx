"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, MessageCircle, Mail } from "lucide-react";
import { PageShell, Card, EmptyState } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import {
  listChannelLinks,
  initChannelLink,
  verifyChannelLink,
  deleteChannelLink,
  type ChannelLink,
} from "@/lib/life";

export default function ChannelsPage() {
  const [links, setLinks] = useState<ChannelLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<{ id: string; channel: string; verifyCode: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLinks(await listChannelLinks());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function start(channel: string) {
    const res = await initChannelLink(channel);
    setPending({ id: res.id, channel: res.channel, verifyCode: res.verifyCode });
  }
  async function verify() {
    if (!pending) return;
    await verifyChannelLink(pending.id, code);
    setLinks(await listChannelLinks());
    setPending(null);
    setCode("");
  }
  async function remove(id: string) {
    await deleteChannelLink(id);
    setLinks((cur) => cur.filter((l) => l.id !== id));
  }

  return (
    <PageShell
      title="Channels"
      subtitle="Telegram and email where Kim can reach you"
    >
      <div className="max-w-2xl space-y-4">
        <Card>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => start("telegram")}>
              <MessageCircle size={13} className="mr-1.5" /> link Telegram
            </Button>
            <Button size="sm" variant="outline" onClick={() => start("email")}>
              <Mail size={13} className="mr-1.5" /> link email
            </Button>
          </div>
          {pending && (
            <div className="mt-4 p-3 rounded-md bg-accent/30 border border-accent">
              <div className="text-xs mb-2">
                Send this verify code to the {pending.channel} bot:
              </div>
              <div className="font-mono text-lg mb-3">{pending.verifyCode}</div>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="confirmation code"
                  className="flex-1 bg-transparent border border-border rounded-md px-3 py-1.5 text-sm"
                />
                <Button size="sm" onClick={verify}>
                  verify
                </Button>
              </div>
            </div>
          )}
        </Card>

        {loading ? (
          <div className="h-24 rounded-lg bg-muted animate-pulse" />
        ) : links.length === 0 ? (
          <EmptyState title="No channels linked" />
        ) : (
          <Card>
            <div className="divide-y divide-border">
              {links.map((l) => (
                <div
                  key={l.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {l.channel}
                      </span>
                      <span>{l.displayName}</span>
                      {l.verified ? (
                        <span className="text-[9px] uppercase tracking-wider text-emerald-600">
                          verified
                        </span>
                      ) : (
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                          pending
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(l.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
