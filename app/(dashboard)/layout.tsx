import { AuthProvider } from "@/app/components/auth/AuthProvider";
import { LazyLoginModal } from "@/app/components/ClientShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <LazyLoginModal />
      {children}
    </AuthProvider>
  );
}
