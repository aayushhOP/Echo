import { FC } from "react";
import { SignIn } from "@clerk/clerk-react";
import { AuthLayout } from "../components/auth/AuthLayout";

export const LoginPage: FC = () => {
  return (
    <AuthLayout
      title="Welcome to Echo Chat"
      subtitle="Connect with your team in real-time"
    >
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/register"
        fallbackRedirectUrl="/chat"
        appearance={{
          elements: {
            rootBox: "w-full flex justify-center",
          },
        }}
      />
    </AuthLayout>
  );
};
