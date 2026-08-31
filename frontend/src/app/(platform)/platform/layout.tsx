import { PlatformShell } from "@/components/platform/platform-shell";

export default function PlatformRootLayout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
