import { useEffect, useState, useCallback } from "react";
import { useUser, useClerk } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";

const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || "";
const basePath = (import.meta.env.BASE_URL as string || "/").replace(/\/$/, "");

export type Tier = "premium";

export interface UserProfile {
  id: number;
  clerkId: string;
  email: string;
  username: string | null;
  tier: Tier;
  isAdmin: boolean;
  premiumExpiresAt: string | null;
  allowedDomainIds: number[];
}

function sessionKey(clerkId: string) {
  return `weyn_session_${clerkId}`;
}

export function useUserTier() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const sync = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !user) return;
    const clerkId = user.id ?? "";
    const email = user.primaryEmailAddress?.emailAddress ?? "";
    const username = user.username ?? user.firstName ?? null;

    const storedToken = localStorage.getItem(sessionKey(clerkId)) ?? undefined;

    try {
      const r = await fetch(`${apiBase}/api/users/me/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkId, email, username, sessionToken: storedToken }),
      });
      const data = await r.json() as UserProfile & { sessionToken?: string | null; kicked?: boolean };

      if (data.kicked) {
        localStorage.removeItem(sessionKey(clerkId));
        toast({
          title: "Signed out",
          description: "Your account was signed in on another device.",
          variant: "destructive",
        });
        await signOut({ redirectUrl: `${basePath}/sign-in` });
        return;
      }

      if (data.sessionToken) {
        localStorage.setItem(sessionKey(clerkId), data.sessionToken);
      }

      setProfile({
        id: data.id,
        clerkId: data.clerkId,
        email: data.email,
        username: data.username,
        tier: "premium",
        isAdmin: data.isAdmin,
        premiumExpiresAt: data.premiumExpiresAt ?? null,
        allowedDomainIds: data.allowedDomainIds ?? [],
      });
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, user, signOut, toast]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setProfile(null);
      setLoading(false);
      return;
    }
    sync();
  }, [isLoaded, isSignedIn, sync]);

  return {
    profile,
    loading,
    tier: "premium" as Tier,
    isAdmin: profile?.isAdmin ?? false,
    premiumExpiresAt: profile?.premiumExpiresAt ?? null,
    allowedDomainIds: profile?.allowedDomainIds ?? [],
    refresh: sync,
  };
}
