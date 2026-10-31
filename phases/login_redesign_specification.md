# Auth Screen Redesign — Technical Specification

**Project Stack:** React 19 · Tailwind CSS · Clerk Auth · Framer Motion

## 1. Overview & Objectives
The current authentication screen uses the default, unstyled Clerk white card, which clashes with the dark navy/electric blue theme of the application. 
This redesign will:
1. **Thematize Clerk:** Apply the `@clerk/themes` dark mode with custom electric blue accents.
2. **Add Animation:** Use `framer-motion` to smoothly slide and fade the auth card into view.
3. **Enhance Background:** Create an animated, glowing background using Tailwind CSS and (optionally) the custom WhatsApp-style wallpaper.

---

## 2. Dependencies

If not already installed, add Framer Motion and the Clerk themes package to your frontend.

```bash
npm install framer-motion @clerk/themes
```

---

## 3. Global Clerk Provider Configuration

To ensure the Clerk components blend seamlessly with your app's dark navy theme, we need to override the default appearance in your main provider.

### `client/src/main.tsx` or `client/src/App.tsx`
Update your `<ClerkProvider>` to use the dark theme and inject your specific brand colors.

```tsx
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';

// Inside your root render function:
<ClerkProvider 
  publishableKey={PUBLISHABLE_KEY}
  appearance={{
    baseTheme: dark,
    variables: {
      colorPrimary: '#0066ff', // Electric Blue
      colorBackground: '#171824', // Dark Navy Card Background
      colorInputBackground: '#13141d', // Darker Input Background
      colorInputText: '#f8fafc',
      colorText: '#e2e8f0',
      colorTextSecondary: '#94a3b8',
      borderRadius: '0.75rem', // 12px rounded corners
    },
    elements: {
      card: 'shadow-2xl border border-white/5', // Subtle glassmorphism border
      formButtonPrimary: 'bg-[#0066ff] hover:bg-[#0052cc] transition-colors',
      footerActionLink: 'text-[#0066ff] hover:text-[#0052cc]',
    }
  }}
>
  <App />
</ClerkProvider>
```

---

## 4. Animated Auth Layout Component

Create a reusable wrapper component that handles the animated background and the Framer Motion entrance animation for the Clerk cards.

### `client/src/components/auth/AuthLayout.tsx`

```tsx
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#13141d] overflow-hidden">
      
      {/* 1. Animated Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#0066ff]/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#8b5cf6]/10 rounded-full blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

      {/* 2. Optional: Subtle Wallpaper Overlay */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none bg-repeat mix-blend-overlay"
        style={{ backgroundImage: 'url(/watermarked_img_4725941447934805168.png)' }} // Ensure image is in public/ folder
      />

      {/* 3. Animated Card Container */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ 
          duration: 0.6, 
          ease: [0.16, 1, 0.3, 1] // Custom snappy spring easing
        }}
        className="relative z-10 w-full max-w-md p-6"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-[#0066ff] rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-[#0066ff]/20">
            {/* Replace with your actual SVG logo */}
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome to Echo Chat</h1>
          <p className="text-sm text-slate-400 mt-1">Connect with your team in real-time</p>
        </div>

        {/* This is where <SignIn /> or <SignUp /> will render */}
        {children}
      </motion.div>
    </div>
  );
};
```

---

## 5. Implement in App Router

Finally, wrap your existing Clerk routing components inside the new `AuthLayout`.

### `client/src/App.tsx` (or your routing file)

```tsx
import { SignIn, SignUp } from "@clerk/clerk-react";
import { AuthLayout } from "./components/auth/AuthLayout";
// ... other imports

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in/*" element={
          <AuthLayout>
            <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
          </AuthLayout>
        } />
        
        <Route path="/sign-up/*" element={
          <AuthLayout>
            <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
          </AuthLayout>
        } />
        
        {/* ... protected chat routes ... */}
      </Routes>
    </BrowserRouter>
  );
}
```

## 6. Checklist for Agent
- [ ] Installed `@clerk/themes` and `framer-motion`.
- [ ] Passed the `appearance` configuration to `<ClerkProvider>` to match the dark navy (`#13141d`) and electric blue (`#0066ff`) theme.
- [ ] Created `AuthLayout.tsx` with animated background orbs and a Framer Motion entrance animation.
- [ ] Wrapped the `<SignIn>` and `<SignUp>` routes with the new `AuthLayout`.
- [ ] Placed the generated WhatsApp-style wallpaper in the `public/` directory for the subtle overlay.