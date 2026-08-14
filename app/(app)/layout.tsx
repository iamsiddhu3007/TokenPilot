import Link from "next/link";
import { requireSession } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const handle = session.user.displayUsername ?? session.user.username ?? session.user.name;

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="border-b border-black/10 dark:border-white/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            TokenPilot
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-foreground/60">@{handle}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
