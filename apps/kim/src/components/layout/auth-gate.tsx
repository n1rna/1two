"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { routes } from "@/lib/routes";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginRoute = pathname === "/login" || pathname.startsWith("/login/");
  const isPublicRoute = isLoginRoute || pathname.startsWith("/m/");

  useEffect(() => {
    if (!isPending && !session && !isPublicRoute) {
      router.replace(routes.login({ redirect: pathname }));
    }
  }, [isPending, session, router, pathname, isPublicRoute]);

  if (isPublicRoute) return <>{children}</>;
  if (isPending || !session) return null;
  return <>{children}</>;
}
