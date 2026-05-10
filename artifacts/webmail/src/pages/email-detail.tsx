import React, { useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Paperclip, User } from "lucide-react";
import { format } from "date-fns";
import { useGetEmail } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function EmailDetailPage() {
  const [, params] = useRoute("/email/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  
  const searchParams = new URLSearchParams(window.location.search);
  const address = searchParams.get("address") || "";
  
  const { data: email, isLoading } = useGetEmail(
    id as string,
    { address },
    { 
      query: { 
        enabled: !!id && !!address,
        queryKey: ["/api/emails", id, { address }] 
      }
    }
  );

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (email?.htmlBody && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  line-height: 1.6;
                  color: #1a1a1a;
                  margin: 0;
                  padding: 1rem 0;
                  max-width: 100%;
                }
                a { color: #2563eb; }
                img { max-width: 100%; height: auto; }
                pre, code { background: #f4f4f5; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
                @media (prefers-color-scheme: dark) {
                  body { color: #ededed; background: transparent; }
                  a { color: #60a5fa; }
                  pre, code { background: #27272a; }
                }
              </style>
            </head>
            <body>
              ${email.htmlBody}
            </body>
          </html>
        `);
        doc.close();
        
        setTimeout(() => {
          if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.style.height = `${iframeRef.current.contentWindow.document.documentElement.scrollHeight}px`;
          }
        }, 100);
      }
    }
  }, [email?.htmlBody]);

  if (isLoading || !email) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <Button variant="ghost" disabled className="mb-6 -ml-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Inbox
        </Button>
        <div className="space-y-6 bg-card border border-border rounded-xl p-8">
          <Skeleton className="h-10 w-3/4" />
          <div className="flex gap-4 items-center">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="pt-8 space-y-4 border-t border-border/50">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <Button 
        variant="ghost" 
        onClick={() => setLocation("/")}
        className="mb-6 -ml-4 gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Inbox
      </Button>
      
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Header Section */}
        <div className="p-6 md:p-8 bg-muted/10 border-b border-border">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-8 leading-tight tracking-tight">
            {email.subject || '(No Subject)'}
          </h1>
          
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-medium text-lg">
              {email.from.charAt(0).match(/[a-z]/i) ? email.from.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="font-semibold text-base text-foreground truncate pr-4">
                  {email.from}
                </div>
                <div className="text-sm text-muted-foreground whitespace-nowrap">
                  {format(new Date(email.date), "MMM d, yyyy 'at' h:mm a")}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                to <span className="font-medium text-foreground/80">{email.to}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Attachments Section */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="bg-muted/5 p-4 border-b border-border px-6 md:px-8 flex flex-wrap gap-3">
            {email.attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-2 bg-background border border-border rounded-md px-3 py-2 text-sm max-w-[250px] shadow-sm hover:border-primary/30 transition-colors cursor-pointer group">
                <Paperclip className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                <span className="truncate flex-1 font-medium text-foreground/90" title={att.filename}>{att.filename}</span>
                <span className="text-xs text-muted-foreground shrink-0 pl-2 border-l border-border">{Math.round(att.size / 1024)}kb</span>
              </div>
            ))}
          </div>
        )}

        {/* Reading Pane */}
        <div className="p-6 md:p-8 bg-background min-h-[500px]">
          {email.htmlBody ? (
            <iframe
              ref={iframeRef}
              title="Email Content"
              className="w-full border-0 transition-all duration-300 bg-transparent"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
              scrolling="no"
            />
          ) : (
            <div className="whitespace-pre-wrap font-mono text-sm text-foreground/90 leading-relaxed">
              {email.textBody || 'No content.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
