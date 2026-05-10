import { SignUp } from "@clerk/react";
import { Mail, CheckCircle, Zap } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkAppearance = {
  elements: {
    card: {
      background: "rgba(255,255,255,0.08)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.18)",
      boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
      borderRadius: "1.25rem",
    },
    headerTitle: { color: "#fff", fontWeight: "800" },
    headerSubtitle: { color: "rgba(255,255,255,0.6)" },
    formFieldLabel: { color: "rgba(255,255,255,0.75)", fontSize: "0.8rem" },
    formFieldInput: {
      background: "rgba(255,255,255,0.12)",
      border: "1px solid rgba(255,255,255,0.2)",
      color: "#fff",
      borderRadius: "0.625rem",
    },
    formButtonPrimary: {
      background: "linear-gradient(135deg, #a78bfa, #6d28d9)",
      border: "none",
      borderRadius: "0.625rem",
      fontWeight: "700",
      boxShadow: "0 4px 15px rgba(109,40,217,0.4)",
    },
    socialButtonsBlockButton: {
      background: "rgba(255,255,255,0.1)",
      border: "1px solid rgba(255,255,255,0.2)",
      color: "#fff",
      borderRadius: "0.625rem",
    },
    socialButtonsBlockButtonText: { color: "#fff" },
    dividerLine: { background: "rgba(255,255,255,0.15)" },
    dividerText: { color: "rgba(255,255,255,0.4)" },
    footerActionLink: { color: "#c4b5fd" },
    footerActionText: { color: "rgba(255,255,255,0.45)" },
    identityPreviewText: { color: "#fff" },
    identityPreviewEditButton: { color: "#c4b5fd" },
    formFieldInputShowPasswordButton: { color: "rgba(255,255,255,0.6)" },
    alternativeMethodsBlockButton: {
      background: "rgba(255,255,255,0.1)",
      border: "1px solid rgba(255,255,255,0.2)",
      color: "#fff",
      borderRadius: "0.625rem",
    },
    otpCodeFieldInput: {
      background: "rgba(255,255,255,0.12)",
      border: "1px solid rgba(255,255,255,0.25)",
      color: "#fff",
    },
  },
};

export function SignUpPage() {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-10"
      style={{
        background: "linear-gradient(135deg, #3b0764 0%, #4f46e5 35%, #6d28d9 65%, #1e1b4b 100%)",
      }}
    >
      {/* Decorative blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-5 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center shadow-lg">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <span className="font-black text-xl text-white tracking-widest uppercase">WEYN EMAILS</span>
      </div>

      {/* Headline */}
      <div className="text-center mb-5 max-w-md relative z-10">
        <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-2">Web Domain Email Platform</p>
        <h1 className="text-2xl font-extrabold text-white leading-tight">
          Create an Account &amp; Receive Emails Instantly
        </h1>
      </div>

      {/* Compact tier pills */}
      <div className="flex gap-2 mb-6 relative z-10">
        <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-3 py-1.5">
          <CheckCircle className="w-3 h-3 text-green-300 shrink-0" />
          <span className="text-white font-bold text-xs">FREE</span>
          <span className="text-white/55 text-xs">— Facebook 8 Digits Security Codes Only</span>
        </div>
        <div className="flex items-center gap-1.5 bg-yellow-400/10 backdrop-blur-sm border border-yellow-300/25 rounded-full px-3 py-1.5">
          <Zap className="w-3 h-3 text-yellow-300 shrink-0" />
          <span className="text-yellow-200 font-bold text-xs">PREMIUM</span>
          <span className="text-white/55 text-xs">— all platforms, no limitation.</span>
        </div>
      </div>

      {/* Clerk form — glassmorphism */}
      <div className="relative z-10 w-full max-w-sm">
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          fallbackRedirectUrl={`${basePath}/`}
          appearance={clerkAppearance}
        />
      </div>

      <p className="text-white/20 text-[10px] mt-6 relative z-10">
        © {new Date().getFullYear()} WEYN EMAILS
      </p>
    </div>
  );
}
