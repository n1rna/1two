import { AuthGate } from "@/components/layout/auth-gate";
import { OnboardingGate } from "@/components/layout/onboarding-gate";
import { KimProvider, KimDrawer } from "@/components/kim";
import { LifeNav } from "@/components/life-nav";
import { KimHeader } from "@/components/kim-header";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthGate>
      <KimProvider>
        <OnboardingGate>
          <style>{`body { overflow: hidden; } main { overflow: hidden !important; min-height: 0; }`}</style>
          <div className="h-screen flex flex-col bg-background">
            <KimHeader />
            <div className="flex-1 min-h-0 flex relative overflow-hidden">
              <LifeNav />
              <main className="flex-1 min-w-0 overflow-y-auto relative">
                {children}
              </main>
              <KimDrawer />
            </div>
          </div>
        </OnboardingGate>
      </KimProvider>
    </AuthGate>
  );
}
