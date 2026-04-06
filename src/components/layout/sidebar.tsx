"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, MapPin, Calendar, Kanban,
  Users, Building2, Settings, ClipboardList, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, iconBg: "bg-violet-500" },
  { href: "/visits",    label: "Visits",    icon: MapPin,           iconBg: "bg-emerald-500" },
  { href: "/calendar",  label: "Calendar",  icon: Calendar,         iconBg: "bg-blue-500" },
  { href: "/deals",     label: "Deals",     icon: Kanban,           iconBg: "bg-pink-500" },
  { href: "/customers", label: "Customers", icon: ClipboardList,    iconBg: "bg-amber-500" },
  { href: "/sites",     label: "Sites",     icon: Building2,        iconBg: "bg-sky-500" },
  { href: "/users",     label: "Users",     icon: Users,            iconBg: "bg-fuchsia-500" },
  { href: "/settings",  label: "Settings",  icon: Settings,         iconBg: "bg-slate-500" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-gradient-to-b from-indigo-950 via-violet-950 to-purple-950 text-white shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-yellow-300" />
        </div>
        <span className="text-base font-bold tracking-tight">BuildFlow</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, iconBg }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/10 hover:text-white"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                active ? iconBg : "bg-white/10 group-hover:bg-white/15"
              )}>
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>
              <span>{label}</span>
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-5">
        <div className="rounded-xl bg-white/10 px-4 py-3 text-xs text-white/40 text-center">
          BuildFlow v1.0
        </div>
      </div>
    </aside>
  );
}
