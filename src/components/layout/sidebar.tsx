"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AlertTriangle, Bot, LayoutDashboard, Network, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/services", label: "Services", icon: Network },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-card/40 px-3 py-4">
      <div className="flex items-center gap-2 px-2 pb-6">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
          C
        </div>
        <span className="text-sm font-semibold tracking-tight">CrisisDesk</span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-2 pt-6 text-[11px] leading-relaxed text-muted-foreground">
        Give the agent a problem,
        <br />
        not a prompt.
      </div>
    </aside>
  );
}
