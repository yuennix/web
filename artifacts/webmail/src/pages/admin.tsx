import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Crown, User, RefreshCw, Users, Star, UserCheck, Lock, Eye, EyeOff, Trash2, UserPlus, ChevronDown, ChevronUp, Globe, Unlock, Webhook, Copy, Check, ExternalLink, KeyRound, AlertCircle } from "lucide-react";
import { DomainsPage } from "@/pages/domains";

const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || "";
const SESSION_KEY = "maildrop-admin-auth";

interface AdminUser {
  id: number;
  clerkId: string;
  email: string;
  username: string | null;
  tier: string;
  isAdmin: boolean;
  premiumExpiresAt: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  premium: number;
  free: number;
}

const DURATIONS = [
  { label: "1 Day", value: "1d" },
  { label: "7 Days", value: "7d" },
  { label: "1 Month", value: "30d" },
];

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const d = new Date(expiresAt);
  const now = new Date();
  if (d < now) return "Expired";
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

export function AdminPage() {
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, premium: 0, free: 0 });
  const [fetching, setFetching] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<Record<number, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importEmails, setImportEmails] = useState("");
  const [importing, setImporting] = useState(false);

  // Domain assignments per user
  const [expandedDomains, setExpandedDomains] = useState<Record<number, boolean>>({});
  const [userDomainIds, setUserDomainIds] = useState<Record<number, number[]>>({});
  const [allDomains, setAllDomains] = useState<{ id: number; name: string }[]>([]);
  const [togglingDomain, setTogglingDomain] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "domains" | "webhook">("users");

  // Webhook tab state
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [webhookHasSecret, setWebhookHasSecret] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookCopiedUrl, setWebhookCopiedUrl] = useState(false);
  const [webhookCopiedSecret, setWebhookCopiedSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const storedPassword = (): string => sessionStorage.getItem(SESSION_KEY) ?? "";

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      setAuthenticated(true);
      fetchUsers(saved);
      fetchAllDomains();
    }
  }, []);

  const fetchAllDomains = async () => {
    try {
      const res = await fetch(`${apiBase}/api/domains`);
      const data = await res.json();
      setAllDomains(data.domains ?? []);
    } catch { /* ignore */ }
  };

  const loadUserDomains = async (userId: number) => {
    try {
      const res = await fetch(`${apiBase}/api/admin/users/${userId}/domains`, {
        headers: { "x-admin-password": storedPassword() },
      });
      const data = await res.json();
      setUserDomainIds(prev => ({ ...prev, [userId]: data.domainIds ?? [] }));
    } catch { /* ignore */ }
  };

  const toggleUserDomain = async (userId: number, domainId: number, currentlyAssigned: boolean) => {
    const key = `${userId}-${domainId}`;
    setTogglingDomain(key);
    try {
      const method = currentlyAssigned ? "DELETE" : "POST";
      await fetch(`${apiBase}/api/admin/users/${userId}/domains/${domainId}`, {
        method,
        headers: { "x-admin-password": storedPassword() },
      });
      setUserDomainIds(prev => ({
        ...prev,
        [userId]: currentlyAssigned
          ? (prev[userId] ?? []).filter(id => id !== domainId)
          : [...(prev[userId] ?? []), domainId],
      }));
    } finally {
      setTogglingDomain(null);
    }
  };

  const toggleDomainPanel = (userId: number) => {
    const isOpen = expandedDomains[userId];
    setExpandedDomains(prev => ({ ...prev, [userId]: !isOpen }));
    if (!isOpen && userDomainIds[userId] === undefined) {
      loadUserDomains(userId);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${apiBase}/api/admin/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, password);
        setAuthenticated(true);
        fetchUsers(password);
        fetchAllDomains();
      } else {
        setAuthError("Wrong password. Try again.");
      }
    } catch {
      setAuthError("Could not connect. Try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchUsers = async (pwd?: string) => {
    setFetching(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/users?t=${Date.now()}`, {
        headers: {
          "x-admin-password": pwd ?? storedPassword(),
          "Cache-Control": "no-cache",
        },
      });
      const data = await res.json();
      setUsers(data.users ?? []);
      if (data.stats) setStats(data.stats);
    } finally {
      setFetching(false);
    }
  };

  const setTier = async (userId: number, tier: string) => {
    setUpdating(userId);
    const duration = selectedDuration[userId] || "7d";
    try {
      const res = await fetch(`${apiBase}/api/admin/users/${userId}/tier`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": storedPassword(),
        },
        body: JSON.stringify({ tier, duration: tier === "premium" ? duration : undefined }),
      });
      const updated = await res.json();
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, tier: updated.tier, premiumExpiresAt: updated.premiumExpiresAt ?? null }
            : u
        )
      );
      setStats((prev) => {
        const wasPremium = users.find((u) => u.id === userId)?.tier === "premium";
        const nowPremium = tier === "premium";
        if (wasPremium === nowPremium) return prev;
        return {
          total: prev.total,
          premium: nowPremium ? prev.premium + 1 : prev.premium - 1,
          free: nowPremium ? prev.free - 1 : prev.free + 1,
        };
      });
    } finally {
      setUpdating(null);
    }
  };

  const syncFromClerk = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch(`${apiBase}/api/admin/sync-from-clerk`, {
        method: "POST",
        headers: { "x-admin-password": storedPassword() },
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg(`Synced: ${data.created} new, ${data.skipped} already existed`);
        fetchUsers();
      } else {
        setSyncMsg(data.error ?? "Sync failed");
      }
    } catch {
      setSyncMsg("Could not reach server");
    } finally {
      setSyncing(false);
    }
  };

  const importUsers = async () => {
    const emails = importEmails
      .split(/[\n,]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    if (emails.length === 0) {
      setImportMsg("No valid email addresses found.");
      return;
    }
    setImporting(true);
    setImportMsg("Validating email addresses…");
    try {
      // Step 1: validate emails via MX + format check
      const validateRes = await fetch(`${apiBase}/api/emails/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const validateData = await validateRes.json();
      const results: { email: string; valid: boolean; reason?: string }[] = validateData.results ?? [];
      const valid = results.filter((r) => r.valid).map((r) => r.email);
      const invalid = results.filter((r) => !r.valid);

      if (valid.length === 0) {
        const reasons = invalid.map((r) => `${r.email}: ${r.reason}`).join(" · ");
        setImportMsg(`❌ All emails failed validation — ${reasons}`);
        return;
      }

      // Step 2: import only valid ones
      const res = await fetch(`${apiBase}/api/admin/users/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": storedPassword(),
        },
        body: JSON.stringify({ emails: valid }),
      });
      const data = await res.json();
      if (res.ok) {
        const parts: string[] = [];
        if (data.created > 0) parts.push(`✅ ${data.created} added`);
        if (data.skipped > 0) parts.push(`${data.skipped} already existed`);
        if (data.notInClerk?.length) parts.push(`❌ Not registered in Clerk (rejected): ${data.notInClerk.join(", ")}`);
        if (invalid.length > 0) parts.push(`❌ Invalid domain/format (rejected): ${invalid.map((r) => `${r.email} — ${r.reason}`).join(", ")}`);
        setImportMsg(parts.join(" · "));
        setImportEmails("");
        fetchUsers();
      } else {
        setImportMsg(`❌ ${data.error ?? "Import failed"}`);
      }
    } catch {
      setImportMsg("Could not reach server");
    } finally {
      setImporting(false);
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    setUpdating(userId);
    try {
      await fetch(`${apiBase}/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { "x-admin-password": storedPassword() },
      });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setStats((prev) => {
        const wasP = users.find((u) => u.id === userId)?.tier === "premium";
        return {
          total: prev.total - 1,
          premium: wasP ? prev.premium - 1 : prev.premium,
          free: wasP ? prev.free : prev.free - 1,
        };
      });
    } finally {
      setUpdating(null);
    }
  };

  const loadWebhookInfo = async () => {
    setWebhookLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/webhook/info`, {
        headers: { "x-admin-password": storedPassword() },
      });
      const data = await res.json();
      setWebhookHasSecret(data.hasSecret ?? false);
      setWebhookSecret(data.secret ?? null);
    } finally {
      setWebhookLoading(false);
    }
  };

  const copyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setWebhookCopiedUrl(true);
    setTimeout(() => setWebhookCopiedUrl(false), 2000);
  };

  const copySecret = (s: string) => {
    navigator.clipboard.writeText(s);
    setWebhookCopiedSecret(true);
    setTimeout(() => setWebhookCopiedSecret(false), 2000);
  };

  const handleSignOut = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthenticated(false);
    setPassword("");
    setUsers([]);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto shadow-lg">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Enter the admin password to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                placeholder="Admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {authError && (
              <p className="text-sm text-red-500 text-center">{authError}</p>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white"
              disabled={authLoading || !password}
            >
              {authLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              {authLoading ? "Verifying…" : "Enter Admin Panel"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-violet-600" />
          <h1 className="text-2xl font-bold">Admin Panel</h1>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={syncFromClerk}
            disabled={syncing || fetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync from Clerk"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchUsers()} disabled={fetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${fetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
            Sign out
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === "users"
              ? "border-violet-600 text-violet-600 dark:text-violet-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4" />
          Users
        </button>
        <button
          onClick={() => setActiveTab("domains")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === "domains"
              ? "border-violet-600 text-violet-600 dark:text-violet-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe className="w-4 h-4" />
          Domains
        </button>
        <button
          onClick={() => { setActiveTab("webhook"); if (!webhookSecret && !webhookLoading) loadWebhookInfo(); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === "webhook"
              ? "border-violet-600 text-violet-600 dark:text-violet-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Webhook className="w-4 h-4" />
          Webhook
        </button>
        {/* Add Users — only on Users tab */}
        {activeTab === "users" && (
          <div className="ml-auto pb-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowImport((v) => !v); setImportMsg(""); }}
              className="text-violet-700 border-violet-300 hover:bg-violet-50 dark:text-violet-300 dark:border-violet-800 dark:hover:bg-violet-900/20"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Users
              {showImport ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>
          </div>
        )}
      </div>

      {/* ── USERS TAB ── */}
      {activeTab === "users" && (<>

      {/* Import users panel */}
      {showImport && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Add users by email</p>
            <p className="text-xs text-muted-foreground">
              Paste email addresses below (one per line or comma-separated). Copy them from your Clerk dashboard.
            </p>
          </div>
          <textarea
            className="w-full rounded-md border border-input bg-background text-sm p-2.5 font-mono resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder={"jhamesediting@gmail.com\npepaypig+2@zohomail.com\naquinoyuen479@gmail.com"}
            value={importEmails}
            onChange={(e) => setImportEmails(e.target.value)}
          />
          {importMsg && (
            <p className={`text-xs font-medium ${importMsg.startsWith("Done") ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              {importMsg}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={importUsers}
              disabled={importing || !importEmails.trim()}
            >
              {importing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              {importing ? "Adding…" : "Add Users"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowImport(false); setImportMsg(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {syncMsg && (
        <div className={`text-sm px-4 py-2 rounded-lg border ${
          syncMsg.startsWith("Synced")
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
        }`}>
          {syncMsg}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <Star className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.premium}</p>
            <p className="text-xs text-muted-foreground">Premium</p>
          </div>
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <p className="text-sm font-semibold text-muted-foreground">
            {users.length} registered user{users.length !== 1 ? "s" : ""}
          </p>
        </div>

        {users.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            {fetching ? "Loading…" : "No users yet."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {users.map((u) => (
              <div key={u.id}>
              <div className="flex items-center gap-4 px-5 py-4 flex-wrap">
                <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                  {u.isAdmin ? (
                    <Shield className="w-4 h-4 text-violet-600" />
                  ) : (
                    <User className="w-4 h-4 text-violet-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate text-foreground">
                    {u.email || u.username || u.clerkId}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Joined {new Date(u.createdAt).toLocaleDateString()}
                    {u.isAdmin && <span className="ml-2 text-violet-500 font-semibold">• Admin</span>}
                  </p>
                  {u.tier === "premium" && u.premiumExpiresAt && (
                    <p className={`text-[11px] font-medium mt-0.5 ${
                      new Date(u.premiumExpiresAt) < new Date()
                        ? "text-red-500"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {formatExpiry(u.premiumExpiresAt)}
                    </p>
                  )}
                </div>

                <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                  ⭐ Premium
                </span>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-8 text-xs gap-1.5 ${
                      expandedDomains[u.id]
                        ? "border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                    onClick={() => toggleDomainPanel(u.id)}
                  >
                    <Globe className="w-3 h-3" />
                    Domain Access
                    {expandedDomains[u.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => deleteUser(u.id)}
                  disabled={updating === u.id}
                  title="Delete user"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              {/* end flex row */}

              {/* Domain assignment panel — only for premium users */}
              {u.tier === "premium" && expandedDomains[u.id] && (
                <div className="mx-5 mb-4 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wider">
                      Domain Access for {u.email || u.username}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {(userDomainIds[u.id] ?? []).length === 0
                        ? "All domains allowed (no restriction)"
                        : `${(userDomainIds[u.id] ?? []).length} domain${(userDomainIds[u.id] ?? []).length !== 1 ? "s" : ""} assigned`}
                    </p>
                  </div>
                  {userDomainIds[u.id] === undefined ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                  ) : allDomains.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No domains configured yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allDomains.map((d) => {
                        const assigned = (userDomainIds[u.id] ?? []).includes(d.id);
                        const isToggling = togglingDomain === `${u.id}-${d.id}`;
                        return (
                          <button
                            key={d.id}
                            onClick={() => toggleUserDomain(u.id, d.id, assigned)}
                            disabled={isToggling}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-all ${
                              assigned
                                ? "bg-violet-600 text-white border-violet-600 hover:bg-violet-700"
                                : "bg-background text-muted-foreground border-border hover:border-violet-400 hover:text-violet-600 dark:hover:border-violet-600"
                            }`}
                          >
                            {isToggling ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : assigned ? (
                              <Lock className="w-3 h-3" />
                            ) : (
                              <Unlock className="w-3 h-3" />
                            )}
                            @{d.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-3">
                    Highlighted domains are accessible to this user. If none are selected, they can use all domains.
                  </p>
                </div>
              )}
              </div>
            ))}
          </div>
        )}
      </div>

      </>)}

      {/* ── DOMAINS TAB ── */}
      {activeTab === "domains" && (
        <DomainsPage />
      )}

      {/* ── WEBHOOK TAB ── */}
      {activeTab === "webhook" && (() => {
        const origin = apiBase || window.location.origin;
        const webhookUrl = `${origin}/api/webhook/email`;
        const isDevUrl = origin.includes("replit.dev") || origin.includes("localhost") || origin.includes("127.0.0.1") || origin.includes("repl.co");
        return (
          <div className="space-y-4">

            {/* ⚠️ Dev URL warning — shown when using non-deployed URL */}
            {isDevUrl && (
              <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-red-700 dark:text-red-300">This is a dev preview URL — Mailwip/Hanami.run cannot reach it</p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Dev preview URLs require a Replit login session. External services (Mailwip, Mailgun, etc.) get <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded font-mono">Unauthorized</code> when they try to POST here.
                  </p>
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                    Fix: Deploy the app → use your <code className="font-mono bg-red-100 dark:bg-red-900/40 px-1 rounded">.replit.app</code> URL in Mailwip instead.
                  </p>
                </div>
              </div>
            )}

            {/* Endpoint URL card */}
            <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Webhook className="w-4 h-4 text-violet-600" />
                <p className="text-sm font-semibold text-foreground">Webhook Endpoint</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste this into your email provider's webhook settings. <span className="font-medium text-foreground">Must be a deployed URL</span> — not a dev preview.
              </p>
              <div className="flex items-center gap-2">
                <code className={`flex-1 text-xs font-mono px-3 py-2.5 rounded-lg border truncate ${isDevUrl ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400" : "bg-muted border-border text-foreground"}`}>
                  {webhookUrl}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => copyWebhookUrl(webhookUrl)}
                >
                  {webhookCopiedUrl ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              {isDevUrl ? (
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Deploy this app first, then come back here to get the correct public URL.
                </p>
              ) : (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> This is a public URL — safe to paste into Mailwip / Hanami.run.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Supports: <span className="font-medium text-foreground">Hanami.run / Mailwip · Mailgun · Postmark · SendGrid · CloudMailin · Generic JSON</span>
              </p>
            </div>

            {/* Webhook secret card */}
            <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="w-4 h-4 text-violet-600" />
                <p className="text-sm font-semibold text-foreground">Webhook Secret</p>
              </div>

              {webhookLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : webhookHasSecret && webhookSecret ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Send this secret in the <code className="bg-muted px-1 rounded">X-Webhook-Secret</code> header (or <code className="bg-muted px-1 rounded">?secret=</code> query param) with every webhook request.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-muted px-3 py-2.5 rounded-lg border border-border truncate text-foreground">
                      {showSecret ? webhookSecret : "•".repeat(Math.min(webhookSecret.length, 32))}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setShowSecret((v) => !v)}
                      title={showSecret ? "Hide secret" : "Reveal secret"}
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => copySecret(webhookSecret)}
                    >
                      {webhookCopiedSecret ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> Secret protection is active — unauthorized requests will be rejected.
                  </p>
                </>
              ) : (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">No secret configured — endpoint is open</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Set the <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded font-mono">WEBHOOK_SECRET</code> environment variable on the API server to enable secret protection.
                    </p>
                  </div>
                </div>
              )}

              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-muted-foreground"
                onClick={loadWebhookInfo}
                disabled={webhookLoading}
              >
                <RefreshCw className={`w-3 h-3 mr-1.5 ${webhookLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {/* All emails info card */}
            <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-4 h-4 text-violet-600" />
                <p className="text-sm font-semibold text-foreground">Email Catch-All</p>
              </div>
              <p className="text-xs text-muted-foreground">
                All incoming emails are stored without any domain or address filtering. New domains are auto-registered on first delivery. Every email sent to any address at your domain will appear in the recipient's inbox.
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
