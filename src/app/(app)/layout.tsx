import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) { const { membership } = await requireSession(); return <AppShell membership={membership}>{children}</AppShell>; }
