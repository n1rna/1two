"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, LogOut } from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";
import { routes } from "@/lib/routes";
import { useTranslation } from "react-i18next";

export function PublicUserMenu() {
  const { t } = useTranslation("common");
  const { data: session, isPending } = useSession();
  const pathname = usePathname();
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

  if (isPending) {
    return <div className="h-8 w-16 rounded-full bg-muted/40 animate-pulse" />;
  }

  if (!session) {
    return (
      <Link
        href={routes.login({ redirect: pathname || routes.home })}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent hover:border-foreground/20 transition-colors text-xs font-medium"
      >
        {t("sign_in")}
        <ArrowRight className="h-3 w-3" />
      </Link>
    );
  }

  const user = session.user;
  const initial =
    (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={menuRef} className="flex items-center gap-2">
      <Link
        href={routes.today}
        className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-xs font-medium hover:bg-accent hover:border-foreground/20 transition-colors"
      >
        {t("go_to_kim")}
        <ArrowRight className="h-3 w-3" />
      </Link>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={t("account_menu_aria")}
          aria-expanded={open}
          className="flex items-center justify-center h-8 w-8 rounded-full overflow-hidden border border-border bg-muted/40 text-xs font-medium hover:ring-2 hover:ring-ring transition-all"
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
            <div className="p-1 space-y-0.5">
              <Link
                href={routes.marketplaceMine}
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
              >
                {t("my_published_items")}
              </Link>
              <Link
                href={routes.today}
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors sm:hidden"
              >
                {t("go_to_kim")}
              </Link>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-destructive"
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
              >
                <LogOut className="h-4 w-4" />
                {t("sign_out")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
