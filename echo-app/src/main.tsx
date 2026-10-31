import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import { App } from "./App";
import "./index.css";

const PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  "pk_test_placeholder_key_for_setup";

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
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
    </React.StrictMode>
  );
}
