import { Suspense } from "react";
import { headers } from "next/headers";
import { LoginContent } from "./login-content";

export default async function LoginPage() {
  const hdrs = await headers();
  const host = (hdrs.get("host") ?? "").toLowerCase();
  const isKim =
    host === "kim.1tt.dev" || host.startsWith("kim.") || host.startsWith("kim-");

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent isKim={isKim} />
    </Suspense>
  );
}
