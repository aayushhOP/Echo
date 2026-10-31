import { FC } from "react";
import { SignUp } from "@clerk/clerk-react";
import { AuthLayout } from "../components/auth/AuthLayout";

export const RegisterPage: FC = () => {
  return (
    <AuthLayout
      title="Create your Account"
      subtitle="Join Echo Chat and start conversations"
    >
      <SignUp
        routing="path"
        path="/register"
        signInUrl="/login"
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
