import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { bootstrapAccountFn, signInUuidFn } from "@/lib/api";
import { useCurrentSiteUserState } from "@/lib/site-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";

function CredentialCard({ credentials }: { credentials: { uuid: string; password: string } }) {
  return (
    <div className="mt-5 rounded-[var(--radius-lg)] bg-bg-subtle p-4">
      <div className="flex items-center gap-2 font-medium"><KeyRound className="size-4" /> Save these credentials</div>
      <p className="mt-1 text-xs leading-relaxed text-muted">The generated password is shown once. There is no email recovery.</p>
      <div className="mt-3 space-y-2 font-mono text-xs">
        <div><span className="text-subtle">UUID:</span> {credentials.uuid}</div>
        <div className="break-all"><span className="text-subtle">Password:</span> {credentials.password}</div>
      </div>
    </div>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { user, isPending } = useCurrentSiteUserState();
  const qc = useQueryClient();
  const [uuid, setUuid] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [credentials, setCredentials] = useState<{ uuid: string; password: string } | null>(null);

  useEffect(() => {
    const fn = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.uuid && detail?.password) setCredentials(detail);
    };
    window.addEventListener("ls:new-credentials", fn);
    return () => window.removeEventListener("ls:new-credentials", fn);
  }, []);

  if (isPending) {
    return <main className="grid min-h-dvh place-items-center bg-bg"><Skeleton className="h-72 w-full max-w-sm rounded-[var(--radius-xl)]" /></main>;
  }
  if (user && mode === "login") return <Navigate to="/dashboard" />;

  async function registerNow() {
    setError(null);
    setPending(true);
    try {
      const result = await bootstrapAccountFn();
      if (!result.credentials) {
        setError("This browser already has an account. Use your existing UUID and password to sign in.");
      } else {
        setCredentials(result.credentials);
        localStorage.setItem("ls_cookie_consent_v1", "1");
        await qc.invalidateQueries({ queryKey: ["site-user"] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await signInUuidFn({ data: { uuid, password } });
      await qc.invalidateQueries({ queryKey: ["site-user"] });
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col bg-bg text-fg">
      <div className="grid-noise pointer-events-none absolute inset-0" />
      <div className="relative z-10 px-5 py-5 md:px-8"><Wordmark /></div>
      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 pb-16">
        <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">{mode === "login" ? "UUID sign in" : "Automatic registration"}</p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">{mode === "login" ? "Sign in" : "Register"}</h1>
        <p className="mt-2 text-sm text-muted">UUID + password authentication. No email, Google, or phone number.</p>

        {mode === "signup" ? (
          <>
            <div className="mt-6 flex items-start gap-3 rounded-[var(--radius-lg)] bg-bg-subtle p-4">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <p className="text-sm text-muted">Click once and the server generates your UUID, a strong random password, and your signed-in session.</p>
            </div>
            <Button className="mt-5" disabled={pending} onClick={() => void registerNow()}>
              <RefreshCw className="size-4" /> {pending ? "Creating…" : "Create my UUID account"}
            </Button>
            {credentials ? <CredentialCard credentials={credentials} /> : null}
            {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          </>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-7 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5"><Label htmlFor="uuid">UUID</Label><Input id="uuid" value={uuid} onChange={(e) => setUuid(e.target.value)} autoComplete="username" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" disabled={pending} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="password">Password</Label><div className="relative"><Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" disabled={pending} className="pr-11" /><button type="button" className="absolute top-0 right-0 grid h-11 w-11 place-items-center text-muted hover:text-fg" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
          </form>
        )}

        <div className="mt-6 text-sm text-muted">{mode === "login" ? <>Need an account? <Link to="/signup" className="text-fg underline-offset-4 hover:underline">Register</Link></> : <>Already have credentials? <Link to="/login" className="text-fg underline-offset-4 hover:underline">Sign in</Link></>}</div>
      </div>
    </main>
  );
}
