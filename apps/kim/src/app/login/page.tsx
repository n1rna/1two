import { Suspense } from "react";
import { LoginContent } from "./login-content";

export const metadata = {
  title: "Sign in · kim",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
