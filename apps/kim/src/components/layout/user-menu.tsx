"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, User } from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";

export function UserMenu() {
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (isPending || !session) {
    return (
      <div className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground">
        <User className="h-3.5 w-3.5" />
      </div>
    );
  }

  const user = session.user;
  const initial =
    (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center justify-center h-8 w-8 rounded-full overflow-hidden border border-border bg-muted/40 text-xs font-medium text-foreground hover:ring-2 hover:ring-ring transition-all"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name || "Account"}
            className="h-8 w-8 object-cover"
          />
        ) : (
          <span aria-hidden>{initial}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg z-50">
          <div className="px-3 py-2.5 border-b border-border">
            {user.name && (
              <p className="text-sm font-medium truncate">{user.name}</p>
            )}
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
          <div className="p-1">
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-destructive"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
