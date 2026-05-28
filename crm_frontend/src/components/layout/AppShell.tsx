import { ReactNode } from "react";
import { TopBar } from "./TopBar";

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  topBar?: ReactNode;
  onOpenCommandPalette?: () => void;
  onQuickCreateLead?: () => void;
  onQuickCreateAccount?: () => void;
}

export function AppShell({
  sidebar,
  children,
  topBar,
  onOpenCommandPalette,
  onQuickCreateLead,
  onQuickCreateAccount,
}: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {topBar ?? (
          <TopBar
            onOpenCommandPalette={onOpenCommandPalette}
            onQuickCreateLead={onQuickCreateLead}
            onQuickCreateAccount={onQuickCreateAccount}
          />
        )}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1440px] px-7 py-6 pb-10 animate-panel-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
