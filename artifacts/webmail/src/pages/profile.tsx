import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { Crown, LogOut, Mail, User, Calendar, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserTier } from "@/hooks/use-user-tier";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function useCountdown(premiumExpiresAt: string | null, onExpired: () => void) {
  const [display, setDisplay] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!premiumExpiresAt) {
      setDisplay(null);
      return;
    }

    let didExpire = false;

    const tick = () => {
      const now = Date.now();
      const end = new Date(premiumExpiresAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setDisplay("Expired");
        setUrgent(true);
        setExpired(true);
        if (!didExpire) {
          didExpire = true;
          onExpired();
        }
        return;
      }

      const totalSec = Math.floor(diff / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;

      const pad = (n: number) => String(n).padStart(2, "0");
      setDisplay(
        days > 0
          ? `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
          : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
      );
      setUrgent(days < 1);
      setExpired(false);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [premiumExpiresAt, onExpired]);

  return { display, urgent, expired };
}

export function ProfilePage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { profile, tier, premiumExpiresAt, isAdmin, loading, refresh } = useUserTier();

  const { display: countdownDisplay, urgent: countdownUrgent, expired: countdownExpired } = useCountdown(
    premiumExpiresAt,
    refresh
  );

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-6">
        <User className="w-12 h-12 text-muted-foreground" />
        <div>
          <p className="text-lg font-semibold text-foreground">You're not signed in</p>
          <p className="text-sm text-muted-foreground mt-1">Sign in to view your profile</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => setLocation("/sign-in")}>
          Sign in
        </Button>
      </div>
    );
  }

  const initial = (user.firstName?.[0] || user.username?.[0] || user.emailAddresses[0]?.emailAddress?.[0] || "U").toUpperCase();
  const displayName = user.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : user.username || "User";
  const email = user.primaryEmailAddress?.emailAddress ?? profile?.email ?? "";

  return (
    <div className="max-w-lg mx-auto p-6 space-y-5">
      {/* Avatar + name */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">{displayName}</h1>
          <p className="text-sm text-muted-foreground truncate">{email}</p>
        </div>
      </div>

      {/* Tier card */}
      <div className="rounded-xl border p-4 flex items-start gap-4 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-violet-100 dark:bg-violet-800/60">
          <Crown className="w-5 h-5 text-violet-600 dark:text-violet-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Premium Account</p>
          <p className="text-xs text-muted-foreground mt-0.5">Full inbox access — all emails visible</p>

          {/* Live countdown for premium */}
          {tier === "premium" && countdownDisplay && (
            <div className={`mt-2 flex items-center gap-1.5 ${countdownUrgent ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className={`text-xs font-mono font-bold ${countdownExpired ? "text-red-600 dark:text-red-400" : ""}`}>
                {countdownExpired ? "Expired — downgrading…" : countdownDisplay}
              </span>
            </div>
          )}
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0 bg-violet-600 text-white">
          ⭐ Premium
        </span>
      </div>

      {/* Details */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Email address</p>
            <p className="text-sm font-semibold text-foreground truncate">{email}</p>
          </div>
        </div>

        {(user.username || profile?.username) && (
          <div className="flex items-center gap-3 px-4 py-3">
            <User className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium">Username</p>
              <p className="text-sm font-semibold text-foreground">{user.username || profile?.username}</p>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="flex items-center gap-3 px-4 py-3">
            <Shield className="w-4 h-4 text-violet-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Role</p>
              <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">Administrator</p>
            </div>
          </div>
        )}
      </div>

      {/* Sign out */}
      <Button
        variant="outline"
        className="w-full h-10 text-sm text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/20"
        onClick={() => signOut({ redirectUrl: `${basePath}/` })}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign out
      </Button>
    </div>
  );
}
