import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import { App } from "./App";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isKeyValid =
  Boolean(PUBLISHABLE_KEY) &&
  !PUBLISHABLE_KEY.includes("placeholder") &&
  (PUBLISHABLE_KEY.startsWith("pk_test_") || PUBLISHABLE_KEY.startsWith("pk_live_"));

const MissingKeyFallback: React.FC = () => (
  <div className="min-h-screen bg-[#0e0f17] text-slate-100 flex items-center justify-center p-6">
    <div className="max-w-md w-full bg-[#171824] border border-red-500/30 rounded-2xl p-6 shadow-2xl">
      <div className="flex items-center gap-3 text-red-400 mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h1 className="text-lg font-bold">Missing Clerk Publishable Key</h1>
      </div>
      <p className="text-sm text-slate-300 mb-4">
        Clerk authentication could not initialize because <code className="bg-[#13141d] px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs">VITE_CLERK_PUBLISHABLE_KEY</code> is either missing or set to a placeholder.
      </p>
      <div className="bg-[#13141d] p-3 rounded-lg text-xs font-mono text-slate-300 mb-5 border border-white/5 space-y-1">
        <div className="text-slate-400"># In echo-app/.env:</div>
        <div className="text-emerald-400">VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</div>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        You can obtain your Publishable Key from the{" "}
        <a
          href="https://dashboard.clerk.com/last-active?path=api-keys"
          target="_blank"
          rel="noreferrer"
          className="text-[#0066ff] hover:underline"
        >
          Clerk Dashboard
        </a>.
      </p>
    </div>
  </div>
);

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      {!isKeyValid ? (
        <MissingKeyFallback />
      ) : (
        <ClerkProvider
          publishableKey={PUBLISHABLE_KEY}
          afterSignOutUrl="/login"
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: "#0066ff", // Electric Blue
              colorBackground: "#171824", // Dark Navy Card Background
              colorInputBackground: "#13141d", // Darker Input Background
              colorInputText: "#f8fafc",
              colorText: "#e2e8f0",
              colorTextSecondary: "#94a3b8",
              borderRadius: "0.75rem", // 12px rounded corners
            },
            elements: {
              card: "shadow-2xl border border-white/5 py-4 px-6", // Subtle glassmorphism border with compact vertical padding
              headerTitle: "hidden", // Hide redundant inner Clerk title since AuthLayout header is displayed
              headerSubtitle: "hidden", // Hide redundant inner Clerk subtitle
              header: "hidden", // Hide empty header spacing
              formButtonPrimary: "bg-[#0066ff] hover:bg-[#0052cc] transition-colors py-2 text-sm",
              footerActionLink: "text-[#0066ff] hover:text-[#0052cc]",
              formFieldInput: "py-1.5 px-3 text-sm",
              formFieldLabel: "text-xs mb-1",
              formFieldRow: "mb-2.5",
              socialButtonsBlockButton: "py-2 text-sm",
              dividerRow: "my-2.5",
              footer: "py-2 text-xs",
            },
          }}
        >
          <App />
        </ClerkProvider>
      )}
    </React.StrictMode>
  );
}

