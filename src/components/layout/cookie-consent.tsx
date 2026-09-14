import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { bootstrapAccountFn, getMe } from "@/lib/api";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "ls_cookie_consent_v1";
type Credentials = { uuid: string; password: string };

export function CookieConsent() {
  const qc = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      let consent = false;
      try {
        consent = localStorage.getItem(CONSENT_KEY) === "1";
      } catch {
        consent = false;
      }
      if (!active) return;
      if (!consent) {
        setVisible(true);
        return;
      }
      try {
        const user = await getMe();
        if (!user && active) setVisible(true);
      } catch {
        if (active) setVisible(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function accept() {
    setBusy(true);
    try {
      const result = await bootstrapAccountFn();
      localStorage.setItem(CONSENT_KEY, "1");
      await qc.invalidateQueries({ queryKey: ["site-user"] });
      if (result.credentials) {
        setCredentials(result.credentials);
      } else {
        setVisible(false);
      }
    } catch {
      // Keep the notice open; never expose server internals in the cookie UI.
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-[var(--radius-xl)] bg-bg-elevated p-4 shadow-2xl ring-1 ring-border md:bottom-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Keep your account signed in</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            We use a required site cookie to keep your UUID account signed in and remember your projects on this browser. No email is required.
          </p>
          {credentials ? (
            <div className="mt-3 rounded-[var(--radius-lg)] bg-bg-subtle p-3 font-mono text-xs">
              <p className="font-sans font-medium">Save these credentials now</p>
              <p className="mt-2 break-all"><span className="text-subtle">UUID:</span> {credentials.uuid}</p>
              <p className="mt-1 break-all"><span className="text-subtle">Password:</span> {credentials.password}</p>
              <p className="mt-2 font-sans text-[11px] leading-relaxed text-subtle">The generated password is shown once and is not stored in readable form on the server.</p>
              <Button className="mt-3" size="sm" onClick={() => setVisible(false)}>Continue</Button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => void accept()} disabled={busy}>
                {busy ? "Setting up…" : "Accept cookies & continue"}
              </Button>
              <Button variant="ghost" asChild>
                <a href="/docs">Privacy details</a>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
