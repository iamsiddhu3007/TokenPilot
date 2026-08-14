export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">TokenPilot</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Your AI engineering manager, on your repo.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
