"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getLifeProfile, type LifeProfile } from "@/lib/life";
import { useSession } from "@/lib/auth-client";
import { routes } from "@/lib/routes";

/**
 * Redirects first-time users to /onboarding until they finish. Once the
 * profile is marked onboarded, users visiting /onboarding are bounced back
 * to the home dashboard.
 *
 * Must be rendered inside AuthGate so the session is already known.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending: sessionPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<LifeProfile | null>(null);
  const [checked, setChecked] = useState(false);

  const isOnboardingRoute =
    pathname === routes.onboarding || pathname.startsWith(`${routes.onboarding}/`);

  // Load profile once we know there's a session.
  useEffect(() => {
    if (sessionPending || !session) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await getLifeProfile();
        if (!cancelled) setProfile(p);
      } catch (e) {
        console.warn("onboarding-gate: failed to load profile", e);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionPending, session]);

  // Listen for profile changes triggered elsewhere (e.g. the stepper saving).
  useEffect(() => {
    function onProfileUpdated(e: Event) {
      const next = (e as CustomEvent<LifeProfile>).detail;
      if (next) setProfile(next);
    }
    window.addEventListener("life-profile-updated", onProfileUpdated);
    return () =>
      window.removeEventListener("life-profile-updated", onProfileUpdated);
  }, []);

  useEffect(() => {
    if (!checked || !profile) return;
    if (!profile.onboarded && !isOnboardingRoute) {
      router.replace(routes.onboarding);
    } else if (profile.onboarded && isOnboardingRoute) {
      router.replace(routes.home);
    }
  }, [checked, profile, isOnboardingRoute, router]);

  // While we haven't decided, don't flash the wrong UI.
  if (!checked) return null;
  if (profile && !profile.onboarded && !isOnboardingRoute) return null;
  if (profile && profile.onboarded && isOnboardingRoute) return null;

  return <>{children}</>;
}
