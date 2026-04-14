"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import type { KimMessage } from "./types";

export function MessageBubble({
  msg,
  children,
}: {
  msg: KimMessage;
  children?: React.ReactNode;
}) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);
  const time = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const copy = async () => {
    await navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="group py-3">
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] opacity-0 group-hover:opacity-60 transition-opacity kim-mono"
              style={{ color: "var(--kim-ink-faint)" }}
            >
              {time}
            </span>
            <span
              className="text-[10px] kim-mono uppercase tracking-[0.18em]"
              style={{ color: "var(--kim-ink-faint)" }}
            >
              you
            </span>
          </div>
          <div
            className="max-w-[88%] px-3 py-2 rounded-sm text-sm whitespace-pre-wrap break-words"
            style={{
              background: "var(--kim-bg-raised)",
              border: "1px solid var(--kim-border)",
              color: "var(--kim-ink)",
            }}
          >
            {msg.content}
            {msg.selection && msg.selection.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {msg.selection.map((s) => (
                  <span
                    key={`${s.kind}-${s.id}`}
                    className="kim-mono text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-sm"
                    style={{
                      color: "var(--kim-amber)",
                      border: "1px solid rgb(232 176 92 / 0.3)",
                    }}
                  >
                    {s.kind}·{s.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group py-3">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[10px] kim-mono uppercase tracking-[0.18em]"
          style={{ color: "var(--kim-amber)" }}
        >
          kim
        </span>
        <span
          className="text-[10px] opacity-0 group-hover:opacity-60 transition-opacity kim-mono"
          style={{ color: "var(--kim-ink-faint)" }}
        >
          {time}
        </span>
        {msg.content && (
          <button
            onClick={copy}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all"
            style={{ color: "var(--kim-ink-faint)" }}
            title="Copy message"
          >
            {copied ? <Check className="h-2.5 w-2.5" style={{ color: "var(--kim-green)" }} /> : <Copy className="h-2.5 w-2.5" />}
          </button>
        )}
      </div>
      <div className="max-w-[92%]">
        {msg.content && (
          <div
            className="text-sm leading-relaxed"
            style={{ color: "var(--kim-ink)" }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 last:mb-0 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 last:mb-0 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold" style={{ color: "var(--kim-ink)" }}>{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children, className }) => {
                  const isBlock = className?.startsWith("language-");
                  if (isBlock) {
                    return (
                      <code
                        className="block kim-mono rounded-sm px-3 py-2 text-xs my-2 overflow-x-auto"
                        style={{
                          background: "var(--kim-bg-sunken)",
                          border: "1px solid var(--kim-border)",
                        }}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code
                      className="kim-mono px-1 py-0.5 rounded text-xs"
                      style={{
                        background: "var(--kim-bg-sunken)",
                        color: "var(--kim-amber)",
                      }}
                    >
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => <pre className="my-2">{children}</pre>,
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:opacity-80"
                    style={{ color: "var(--kim-amber)" }}
                  >
                    {children}
                  </a>
                ),
                h1: ({ children }) => <p className="kim-display text-lg mb-1" style={{ color: "var(--kim-ink)" }}>{children}</p>,
                h2: ({ children }) => <p className="font-semibold text-sm mb-1" style={{ color: "var(--kim-ink)" }}>{children}</p>,
                h3: ({ children }) => <p className="font-semibold text-xs mb-1 uppercase tracking-wider" style={{ color: "var(--kim-ink-dim)" }}>{children}</p>,
                blockquote: ({ children }) => (
                  <blockquote
                    className="border-l-2 pl-3 italic my-2"
                    style={{
                      borderColor: "var(--kim-teal-dim)",
                      color: "var(--kim-ink-dim)",
                    }}
                  >
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="my-2" style={{ borderColor: "var(--kim-border)" }} />,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="text-xs border-collapse w-full">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th
                    className="text-left px-2 py-1 font-semibold text-xs"
                    style={{ borderBottom: "1px solid var(--kim-border-strong)", color: "var(--kim-amber)" }}
                  >
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-2 py-1 text-xs" style={{ borderBottom: "1px solid var(--kim-border)" }}>
                    {children}
                  </td>
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
