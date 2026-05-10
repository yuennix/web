import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Inbox, Mail, Menu, X, Moon, Sun, Shield, LogOut, Crown, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useUser, useClerk, Show } from "@clerk/react";
import { useUserTier } from "@/hooks/use-user-tier";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { tier, isAdmin, premiumExpiresAt } = useUserTier();

  const navItems = [
    { href: "/", label: "Inbox", icon: Inbox },
  ];

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleSignOut = () => signOut({ redirectUrl: `${basePath}/` });

  const expiryLabel = (): string | null => {
    if (!premiumExpiresAt) return null;
    const d = new Date(premiumExpiresAt);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff <= 0) return null;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days === 1) return "1 day left";
    return `${days}d left`;
  };

  const TierBadge = () => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
      <Crown className="w-2.5 h-2.5" /> Premium
      {expiryLabel() && <span className="opacity-70">· {expiryLabel()}</span>}
    </span>
  );

  return (
    <div className="min-h-[100dvh] w-full flex flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-sm">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <span className="font-black tracking-widest text-foreground text-base uppercase">WEYN EMAILS</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
              <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-border px-3 py-3 space-y-1 bg-background/95 backdrop-blur-sm">
            {navItems.map((item) => {
              const active = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>
              <Shield className="w-4 h-4" /> Admin
            </Link>
            <Show when="signed-in">
              <Link href="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>
                <UserCircle className="w-4 h-4" /> Profile
              </Link>
              <div className="px-3 py-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{user?.firstName || user?.username}</p>
                  <TierBadge />
                </div>
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-8 text-xs shrink-0">
                  <LogOut className="w-3.5 h-3.5 mr-1" /> Sign out
                </Button>
              </div>
            </Show>
          </div>
        )}
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-card sticky top-0 h-[100dvh] shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-md">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-black text-foreground text-sm tracking-widest uppercase">WEYN EMAILS</span>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest leading-none mt-0.5">Client</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 mb-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Navigation</div>
          {navItems.map((item) => {
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  active
                    ? "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className={`w-4 h-4 transition-colors ${active ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground/70 group-hover:text-foreground"}`} />
                {item.label}
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500" />}
              </Link>
            );
          })}
          <Link
            href="/admin"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
              location === "/admin"
                ? "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Shield className="w-4 h-4" />
            Admin
            {location === "/admin" && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500" />}
          </Link>
        </nav>

        {/* User / Auth Footer */}
        <div className="p-4 border-t border-border space-y-3">
          <Show when="signed-in">
            <Link href="/profile" className="flex items-center gap-2 px-1 rounded-lg hover:bg-muted transition-colors cursor-pointer group">
              <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-700 dark:text-violet-300 font-bold text-sm shrink-0 group-hover:bg-violet-200 dark:group-hover:bg-violet-800/60 transition-colors">
                {(user?.firstName?.[0] || user?.username?.[0] || "U").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{user?.firstName || user?.username || "User"}</p>
                <TierBadge />
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500" onClick={(e) => { e.preventDefault(); handleSignOut(); }} title="Sign out">
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </Show>
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] text-muted-foreground font-mono">v1.0.0</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground" onClick={toggleTheme} title="Toggle theme">
              <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 bg-background">
        {children}
      </main>
    </div>
  );
}
