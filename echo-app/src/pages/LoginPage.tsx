import { FC } from "react";
import { SignIn } from "@clerk/clerk-react";
import { MessageSquare } from "lucide-react";

export const LoginPage: FC = () => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-slate-950">
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white mb-2 shadow-lg shadow-indigo-600/30">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">Echo Chat</h1>
      </div>
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/register"
        fallbackRedirectUrl="/chat"
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-slate-900 border border-slate-800 shadow-2xl text-white",
          },
        }}
      />
    </div>
  );
};
