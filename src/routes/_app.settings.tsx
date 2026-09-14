import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { changePasswordFn, getCredentialsFn, rotateUuidFn, updateProfileFn } from "@/lib/api";
import { useCurrentSiteUser, useCurrentSiteUserState } from "@/lib/site-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/settings")({ component: AccountSettings });

function AccountSettings() {
  const { isPending } = useCurrentSiteUserState();
  const user = useCurrentSiteUser();
  const [name, setName] = useState("");
  const [uuid, setUuid] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    setName(user?.displayName === "Guest" ? "" : user?.displayName ?? "");
  }, [user?.displayName]);
  useEffect(() => {
    void getCredentialsFn().then((r) => setUuid(r.uuid));
  }, []);

  if (isPending || !user) return null;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 md:px-8">
      <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">Settings</p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Account</h1>
      <p className="mt-2 text-sm text-muted">Your UUID is your login ID. Projects remain attached to the same internal account when you rotate it.</p>

      <section className="mt-8 space-y-3 rounded-[var(--radius-xl)] bg-bg-elevated p-5 shadow-[var(--shadow-border)]">
        <div>
          <Label>Login UUID</Label>
          <p className="mt-1 break-all rounded-[var(--radius-sm)] bg-bg-subtle p-3 font-mono text-xs">{uuid ?? "Loading…"}</p>
          <p className="mt-2 text-xs text-subtle">Store this somewhere safe. A new UUID replaces the old login ID.</p>
        </div>
        <Button
          variant="secondary"
          disabled={rotating}
          onClick={async () => {
            setRotating(true);
            try {
              const result = await rotateUuidFn();
              setUuid(result.uuid);
              toast.success("New UUID generated");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not rotate UUID");
            } finally {
              setRotating(false);
            }
          }}
        >
          {rotating ? "Generating…" : "Generate another UUID"}
        </Button>
      </section>

      <form
        className="mt-6 space-y-3 rounded-[var(--radius-xl)] bg-bg-elevated p-5 shadow-[var(--shadow-border)]"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            await updateProfileFn({ data: { displayName: name } });
            toast.success("Name saved");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Update failed");
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save name"}</Button>
      </form>

      <div className="mt-12 space-y-3 border-t border-border pt-8">
        <h2 className="font-display text-lg font-semibold">Change password</h2>
        <p className="text-sm text-muted">There is no email recovery. To change the password from Settings, verify the current password first.</p>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (newPassword.length < 16) {
              toast.error("New password must be at least 16 characters");
              return;
            }
            setChanging(true);
            try {
              await changePasswordFn({ data: { currentPassword, newPassword } });
              setCurrentPassword("");
              setNewPassword("");
              toast.success("Password updated");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not update password");
            } finally {
              setChanging(false);
            }
          }}
        >
          <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" />
          <Input type="password" autoComplete="new-password" minLength={16} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New strong password" />
          <Button type="submit" variant="secondary" disabled={changing}>{changing ? "Updating…" : "Update password"}</Button>
        </form>
      </div>
    </div>
  );
}
