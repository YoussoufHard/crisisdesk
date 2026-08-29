"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { WebMCPProvider } from "@/lib/webmcp/register";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ApprovalDialog } from "@/components/agent/approval-dialog";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WebMCPProvider>
      <TooltipProvider delay={150}>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
          </div>
        </div>
        <ApprovalDialog />
      </TooltipProvider>
    </WebMCPProvider>
  );
}
