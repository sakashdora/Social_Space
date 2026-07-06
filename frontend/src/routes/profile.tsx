import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useState } from "react";
import { KeyRound, AlertTriangle, ShieldAlert, Trash2, Key, Check } from "lucide-react";
import { FrostedPanel } from "@/components/veil/FrostedPanel";
import { VeilGlyph } from "@/components/veil/VeilGlyph";
import { neverCollected } from "@/lib/mock/data";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { getCurrentUser, updateSecurityKey, deleteAccount } from "@/lib/api";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Social Space" },
      {
        name: "description",
        content:
          "Your pseudonym, avatar, security settings, and data life policies.",
      },
      { property: "og:title", content: "Profile — Social Space" },
      { property: "og:description", content: "Your handle. Your keys. Your call." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const user = getCurrentUser() || { handle: "anonymous" };

  const [newKey, setNewKey] = useState("");
  const [keySuccess, setKeySuccess] = useState("");
  const [keyError, setKeyError] = useState("");

  const updateKeyMutation = useMutation({
    mutationFn: updateSecurityKey,
    onSuccess: () => {
      setNewKey("");
      setKeyError("");
      setKeySuccess("Security key updated successfully! Please write it down.");
    },
    onError: (err: any) => {
      setKeySuccess("");
      setKeyError(err.message || "Failed to rotate security key.");
    }
  });

  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      navigate({ to: "/" });
    },
    onError: (err: any) => {
      alert(err.message || "Failed to purge account.");
    }
  });

  const handleRotateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKey.trim().length < 3) {
      setKeyError("New passphrase must be at least 3 characters.");
      return;
    }
    updateKeyMutation.mutate(newKey.trim());
  };

  const handleDeleteAccount = () => {
    const doubleCheck = confirm(
      "CRITICAL: Are you absolutely sure? This will permanently delete your account, posts, comments, reactions, and chat messages. This action is 100% unrecoverable."
    );
    if (doubleCheck) {
      deleteAccountMutation.mutate();
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-10 sm:px-6 lg:pt-14">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Profile Settings</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">Your identity. Your keys. Your call.</h1>
      </header>

      {/* Avatar Card */}
      <FrostedPanel className="flex items-center gap-5 p-6 mb-6">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--veil) 60%, black), color-mix(in oklab, var(--veil-glow) 30%, black))",
          }}
        >
          <VeilGlyph className="h-8 w-8 text-white/85" />
        </div>
        <div className="min-w-0 flex-1">
          <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Your handle</label>
          <p className="text-xl font-semibold text-foreground mt-1">@{user.handle}</p>
        </div>
      </FrostedPanel>

      {/* Security Key Settings */}
      <FrostedPanel className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Key className="h-5 w-5 text-[color:var(--veil-glow)]" />
          <h2 className="font-serif text-2xl">Change Security Key</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Rotate your recovery passphrase (security key). Make sure to write it down securely. We cannot reset it if lost.
        </p>

        <form onSubmit={handleRotateKey} className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3.5 py-3">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Enter new passphrase (e.g. solar-wind-echo)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 text-foreground"
            />
            <button
              type="submit"
              disabled={updateKeyMutation.isPending || !newKey.trim()}
              className="rounded-lg bg-[color:var(--veil-glow)] px-4 py-1.5 text-xs font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
            >
              {updateKeyMutation.isPending ? "Updating..." : "Update Key"}
            </button>
          </div>

          {keySuccess && (
            <p className="flex items-center gap-1.5 text-xs text-green-400">
              <Check className="h-4 w-4" /> {keySuccess}
            </p>
          )}
          {keyError && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertTriangle className="h-4 w-4" /> {keyError}
            </p>
          )}
        </form>
      </FrostedPanel>

      {/* Danger Zone */}
      <FrostedPanel className="border-red-500/20 bg-red-500/[0.02] p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <ShieldAlert className="h-5 w-5 text-red-500" />
          <h2 className="font-serif text-2xl text-red-400">Danger Zone</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          Permanently delete your account. This action instantly purges your handle, profile, posts, comments, and messages. There is absolutely no way to recover this data.
        </p>
        
        <button
          onClick={handleDeleteAccount}
          disabled={deleteAccountMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-5 py-3 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          {deleteAccountMutation.isPending ? "Purging Account..." : "Permanently Delete Account"}
        </button>
      </FrostedPanel>

      <section>
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--veil-glow)]">Data &amp; Privacy</p>
          <h2 className="mt-2 font-serif text-3xl">What Social Space never collects.</h2>
        </div>
        <FrostedPanel>
          <ul className="grid gap-px overflow-hidden rounded-2xl sm:grid-cols-2">
            {neverCollected.map((n) => (
              <li key={n} className="flex items-center gap-3 bg-white/[0.02] px-4 py-3 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--danger)]/70" />
                {n}
              </li>
            ))}
          </ul>
        </FrostedPanel>
      </section>
    </div>
  );
}
