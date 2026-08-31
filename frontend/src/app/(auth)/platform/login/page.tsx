import { AuthLayout } from "@/components/auth/auth-layout";
import { PlatformLoginForm } from "@/components/auth/platform-login-form";

export default function PlatformLoginPage() {
  return (
    <AuthLayout
      title="Platform admin sign in"
      subtitle="Manage organizations and platform-wide settings"
    >
      <PlatformLoginForm />
    </AuthLayout>
  );
}
