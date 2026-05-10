import { useState } from "react";
import { format } from "date-fns";
import {
  Globe, Plus, Trash2, ShieldCheck, Copy, Check, FlaskConical,
  ChevronDown, ChevronUp, ExternalLink, AlertCircle, Webhook, Server, Dna, Download, RefreshCw,
  Lock, Unlock
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useListDomains, useAddDomain, useDeleteDomain, useUpdateDomain } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const domainSchema = z.object({
  name: z
    .string()
    .min(3, "Domain name is too short")
    .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Must be a valid domain (e.g. example.com)"),
});

const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const webhookUrl = `${apiBase}/api/webhook/email`;

function CopyCode({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-sm group">
      <span className="flex-1 break-all text-foreground/90">{label ?? value}</span>
      <button
        onClick={copy}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        title="Copy"
      >
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

function DnsRow({ type, name, value, priority }: { type: string; name: string; value: string; priority?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <tr className="border-t border-border hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2.5">
        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300">
          {type}
        </span>
      </td>
      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{name}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-foreground max-w-[200px] truncate" title={value}>{value}</td>
      {priority !== undefined && <td className="px-3 py-2.5 text-xs text-muted-foreground text-center">{priority}</td>}
      <td className="px-3 py-2.5">
        <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </td>
    </tr>
  );
}

function SetupGuide({ domain }: { domain: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-medium text-foreground"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-violet-500" />
          Full Setup Guide for <span className="font-mono text-violet-600 dark:text-violet-400">{domain}</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-5 space-y-8 bg-card border-t border-border">

          {/* Step 1: Webhook */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center">
              <Webhook className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h4 className="font-semibold text-foreground text-sm">Step 1 — Configure Webhook in Hanami.run</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Go to{" "}
                  <a href="https://app.hanami.run" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground inline-flex items-center gap-0.5">
                    app.hanami.run <ExternalLink className="w-3 h-3" />
                  </a>
                  {" "}→ Webhooks, and create a new webhook with the URL below. Set "Match email" to{" "}
                  <code className="font-mono bg-muted px-1 rounded">*@{domain}</code> to capture all emails for this domain.
                </p>
              </div>
              <CopyCode value={webhookUrl} />
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Make sure "Match email" is set to <code className="font-mono">*@{domain}</code> (asterisk wildcard) — not a specific address — so all emails for your domain are forwarded.
                </p>
              </div>
            </div>
          </div>

          {/* Step 2: DNS */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center">
              <Dna className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h4 className="font-semibold text-foreground text-sm">Step 2 — Add DNS Records</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  In your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) add these records for{" "}
                  <span className="font-mono text-foreground">{domain}</span>. This tells the internet to route incoming mail through Hanami.run.
                </p>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Value</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</th>
                      <th className="px-3 py-2.5 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    <DnsRow type="MX" name="@" value="mx1.hanami.run" priority="10" />
                    <DnsRow type="MX" name="@" value="mx2.hanami.run" priority="20" />
                    <DnsRow type="TXT" name="@" value="v=spf1 include:spf.hanami.run ~all" />
                    <DnsRow type="TXT" name="_dmarc" value={`v=DMARC1; p=none; rua=mailto:postmaster@${domain}`} />
                  </tbody>
                </table>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  DNS changes can take <strong>up to 48 hours</strong> to propagate worldwide, though it's usually much faster (5–30 minutes). You can verify at{" "}
                  <a href={`https://mxtoolbox.com/SuperTool.aspx?action=mx%3a${domain}&run=toolpage`} target="_blank" rel="noreferrer" className="underline hover:text-blue-600">
                    mxtoolbox.com
                  </a>.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3: Verify */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center">
              <Server className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h4 className="font-semibold text-foreground text-sm">Step 3 — Test It</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Once DNS is live, click <strong>Send Test</strong> next to this domain to inject a test email directly. Then open your inbox at:
                </p>
              </div>
              <CopyCode value={`hello@${domain}`} />
              <p className="text-xs text-muted-foreground">
                You can use <strong>any alias</strong> before the @ — e.g. <code className="font-mono">signup@{domain}</code>, <code className="font-mono">newsletter@{domain}</code>. All land in the same inbox when you type that address.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ADMIN_SESSION_KEY = "maildrop-admin-auth";
const getAdminPassword = () => sessionStorage.getItem(ADMIN_SESSION_KEY) ?? "";

export function DomainsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sendingTest, setSendingTest] = useState<number | null>(null);
  const [importingTempMail, setImportingTempMail] = useState(false);

  const sendTestEmail = async (domainId: number, domain: string) => {
    setSendingTest(domainId);
    try {
      const res = await fetch(`${apiBase}/api/test/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: `hello@${domain}`,
          from: "sender@example.com",
          subject: "Test Email — Your inbox is working!",
          body: `<p>Hello! This is a <strong>test email</strong> for <code>${domain}</code>.</p><p>If you can see this, your webhook and domain are set up correctly.</p>`,
        }),
      });
      if (res.ok) {
        toast({ title: "Test email sent!", description: `Check inbox for hello@${domain}` });
        queryClient.invalidateQueries({ queryKey: ["/api/emails"] });
      } else {
        toast({ title: "Failed to send test email", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to send test email", variant: "destructive" });
    } finally {
      setSendingTest(null);
    }
  };

  const importFromTempMail = async () => {
    const pwd = getAdminPassword();
    if (!pwd) {
      toast({ title: "Not authenticated", description: "Please log in to the admin panel first.", variant: "destructive" });
      return;
    }
    setImportingTempMail(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/domains/import-from-temp-mail`, {
        method: "POST",
        headers: { "x-admin-password": pwd },
      });
      const data = await res.json();
      if (res.ok) {
        const msg = data.added > 0
          ? `Added ${data.added} domain${data.added !== 1 ? "s" : ""}${data.skipped > 0 ? `, ${data.skipped} already existed` : ""}.`
          : `All ${data.skipped} domains already existed — nothing new to add.`;
        toast({ title: "temp-mail.io import done", description: msg });
        queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      } else {
        toast({ title: "Import failed", description: data.error ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Import failed", description: "Could not reach server", variant: "destructive" });
    } finally {
      setImportingTempMail(false);
    }
  };

  const { data: domainsData, isLoading: isLoadingDomains } = useListDomains();
  const addDomain = useAddDomain();
  const deleteDomain = useDeleteDomain();
  const updateDomain = useUpdateDomain();
  const [togglingLock, setTogglingLock] = useState<number | null>(null);

  const handleToggleLock = async (id: number, name: string, currentlyLocked: boolean) => {
    setTogglingLock(id);
    updateDomain.mutate(
      { id, data: { premiumOnly: !currentlyLocked } },
      {
        onSuccess: () => {
          toast({
            title: currentlyLocked ? `${name} unlocked` : `${name} locked to Premium`,
            description: currentlyLocked
              ? "Free users can now use this domain."
              : "Only premium users can use this domain.",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
        },
        onError: () => {
          toast({ title: "Failed to update domain", variant: "destructive" });
        },
        onSettled: () => setTogglingLock(null),
      }
    );
  };

  const form = useForm<z.infer<typeof domainSchema>>({
    resolver: zodResolver(domainSchema),
    defaultValues: { name: "" },
  });

  const onSubmit = (values: z.infer<typeof domainSchema>) => {
    addDomain.mutate(
      { data: { name: values.name.toLowerCase() } },
      {
        onSuccess: () => {
          toast({ title: "Domain added", description: `${values.name} is now connected.` });
          form.reset();
          queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
        },
        onError: (error) => {
          toast({
            title: "Failed to add domain",
            description: error.error || "An unexpected error occurred.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Remove ${name}? This will stop receiving emails for this domain.`)) return;
    deleteDomain.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Domain removed", description: `${name} has been removed.` });
          queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
        },
        onError: (error) => {
          toast({
            title: "Failed to remove domain",
            description: error.error || "An unexpected error occurred.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-10">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Domains</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect your domains to receive emails. You can add as many as you want.
        </p>
      </div>

      {/* Add domain */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider text-muted-foreground">Add Domain</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-2 text-xs border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40"
            onClick={importFromTempMail}
            disabled={importingTempMail}
          >
            {importingTempMail
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <Download className="w-3.5 h-3.5" />
            }
            {importingTempMail ? "Importing…" : "Import from temp-mail.io"}
          </Button>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        className="h-10 font-mono text-sm bg-background"
                        placeholder="yourdomain.com"
                        data-testid="input-domain-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="h-10 px-6 bg-violet-600 hover:bg-violet-700 text-white border-transparent"
                disabled={addDomain.isPending}
                data-testid="button-add-domain"
              >
                {addDomain.isPending ? (
                  "Adding..."
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Domain
                  </>
                )}
              </Button>
            </form>
          </Form>
        </div>
      </section>

      {/* Domains list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Connected Domains</h2>
          {domainsData?.domains?.length ? (
            <span className="text-xs text-muted-foreground">
              {domainsData.domains.length} domain{domainsData.domains.length !== 1 ? "s" : ""}
            </span>
          ) : null}
        </div>

        {isLoadingDomains ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 flex justify-between items-center">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        ) : !domainsData?.domains?.length ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
            <Globe className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No domains connected yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Add your first domain above to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {domainsData.domains.map((domain) => (
              <div key={domain.id} className="space-y-2" data-testid={`domain-row-${domain.id}`}>
                {/* Domain card */}
                <div className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950/40 dark:to-indigo-950/40 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-foreground">{domain.name}</span>
                        {domain.active && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <ShieldCheck className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Added {format(new Date(domain.createdAt), "MMM d, yyyy")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => sendTestEmail(domain.id, domain.name)}
                      disabled={sendingTest === domain.id}
                    >
                      <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                      {sendingTest === domain.id ? "Sending..." : "Send Test"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDelete(domain.id, domain.name)}
                      disabled={deleteDomain.isPending}
                      data-testid={`delete-domain-${domain.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Remove
                    </Button>
                  </div>
                </div>

                {/* Expandable setup guide per domain */}
                <SetupGuide domain={domain.name} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Global webhook reference */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Your Webhook URL</h2>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
          <p className="text-sm text-muted-foreground">Use this URL in any email provider to forward emails to your inbox:</p>
          <CopyCode value={webhookUrl} />
        </div>
      </section>
    </div>
  );
}
