import { ReactNode } from "react";

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ height: "100vh" }}
    >
      {sidebar}
      <div className="flex-1 overflow-y-auto bg-bg">
        <div
          className="p-7 pb-8"
          style={{ padding: "28px 32px" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
