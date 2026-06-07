import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Stethoscope, LogOut, Menu, X, ChevronLeft
} from "lucide-react";

import { useProgram } from "@/contexts/ProgramContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

interface DashboardLayoutProps {
  children: ReactNode;
  roleName: string;
  roleColor: string;
  navItems: NavItem[];
}

export default function DashboardLayout({ children, roleName, roleColor, navItems }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentProgram, setProgram } = useProgram();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-2 h-16 px-5 border-b border-sidebar-border shrink-0">
          {currentProgram !== 'MIDAS' ? (
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-white/10 p-0.5">
              <img src="/icon_logo.png" alt="Madras ICON Logo" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-primary-foreground" />
            </div>
          )}
          <span className="font-display text-lg font-bold tracking-tight">
            {currentProgram === 'MIDAS' ? 'MIDAS' : 'Madras ICON'}
          </span>
        </div>

        <div className="px-4 py-3 space-y-3">
          <div className={cn("inline-block px-2.5 py-1 rounded-md text-xs font-semibold", roleColor)}>
            {roleName}
          </div>
          
          {roleName === 'Admin' && (
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-bold text-sidebar-foreground/40 px-1">
                Active Program
              </label>
              <Select value={currentProgram} onValueChange={(v) => setProgram(v as any)}>
                <SelectTrigger className="h-9 bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground">
                  <SelectValue placeholder="Select Program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MIDAS">MIDAS Scientific</SelectItem>
                  <SelectItem value="ICON">Madras ICON</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Ad Box */}
        <div className="px-3 py-2 mx-3 my-4 rounded-xl border border-sidebar-border overflow-hidden bg-sidebar-accent/10 flex items-center justify-center">
          <img src="/gold.png" alt="Gold Sponsor" className="w-full h-auto rounded-lg object-contain" />
        </div>

        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={() => navigate("/login")}
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 lg:pl-64">
        <header className="sticky top-0 z-20 h-14 flex items-center justify-between gap-3 px-4 border-b border-border glass">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-foreground" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <Button variant="ghost" size="sm" className="hidden lg:inline-flex" onClick={() => navigate("/")}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Home
            </Button>
          </div>

          <div className="flex-1 text-center hidden md:block">
             <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
               {currentProgram} Management Portal
             </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">Live Portal</span>
          </div>
        </header>

        <main className="p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
