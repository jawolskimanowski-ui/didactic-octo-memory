import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { changePasswordFn, signInUuidFn } from "@/lib/api";
import { useCurrentSiteUserState } from "@/lib/site-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wordmark } from "@/components/brand/logo";

export const Route = createFileRoute("/forgot-password")({ component: ChangePasswordByUuid });

function ChangePasswordByUuid() {
  const { user } = useCurrentSiteUserState();
  const [uuid, setUuid] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // UUID login establishes the site session; then the password change is owner-verified.
      await signInUuidFn({ data: { uuid, password: currentPassword } });
      await changePasswordFn({ data: { currentPassword, newPassword } });
      toast.success("Password updated");
      window.location.assign("/settings");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password");
    } finally { setBusy(false); }
  }

  if (user) return <div className="p-8">Already signed in. Change your password from <Link className="underline" to="/settings">Settings</Link>.</div>;

  return (
    <main className="flex min-h-dvh flex-col bg-bg px-5 py-5 text-fg">
      <Wordmark />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <h1 className="font-display text-3xl font-semibold">Change password</h1>
        <p className="mt-2 text-sm text-muted">No email recovery is used. Enter your UUID and current password, then choose a new one.</p>
        <form className="mt-7 space-y-3" onSubmit={(e) => void submit(e)}>
          <Input value={uuid} onChange={(e) => setUuid(e.target.value)} placeholder="UUID" required />
          <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" required />
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (16+ chars)" minLength={16} required />
          <Button className="w-full" disabled={busy}>{busy ? "Updating…" : "Change password"}</Button>
        </form>
        <Link to="/login" className="mt-5 text-sm text-muted hover:text-fg">Back to sign in</Link>
      </div>
    </main>
  );
}
