import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useState } from "react";
import {
  KeyRound, AlertTriangle, ShieldAlert, Trash2, Key, Check,
  Fingerprint, QrCode, RefreshCw, LogOut, Clock, Shield,
  ChevronRight, X, Eye, EyeOff, Smartphone, Activity,
  AlertCircle, CheckCircle2, Info
} from "lucide-react";
import { FrostedPanel } from "@/components/veil/FrostedPanel";
import { VeilGlyph } from "@/components/veil/VeilGlyph";
import { neverCollected } from "@/lib/mock/data";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCurrentUser,
  logoutUser,
  changePassphrase,
  logoutAllDevices,
  deleteAccount,
  setupTotp,
  enableTotp,
  disableTotp,
  getTotpStatus,
  listPasskeys,
  getPasskeyRegisterOptions,
  verifyPasskeyRegistration,
  removePasskey,
  regenerateRecoveryCodes,
  getSecurityEvents,
  getMe,
} from "@/lib/api";
import { startRegistration } from "@simplewebauthn/browser";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Social Space" },
      {
        name: "description",
        content: "Your pseudonym, security settings, passkeys, two-factor auth, and data life policies.",
      },
      { property: "og:title", content: "Profile — Social Space" },
      { property: "og:description", content: "Your handle. Your keys. Your call." },
    ],
  }),
  component: Profile,
});

// ─── Helper: Passphrase modal ─────────────────────────────────────────────────
function PassphraseModal({
  title,
  description,
  onConfirm,
  onClose,
  isLoading,
  error,
}: {
  title: string;
  description: string;
  onConfirm: (passphrase: string) => void;
  onClose: () => void;
  isLoading: boolean;
  error: string;
}) {
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[color:var(--ink)] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-serif text-xl">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 mb-3">
          <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            type={show ? "text" : "password"}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Current passphrase"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            onKeyDown={(e) => e.key === "Enter" && pass && onConfirm(pass)}
          />
          <button onClick={() => setShow((v) => !v)} className="text-muted-foreground">
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        {error && (
          <p className="flex items-center gap-1.5 text-xs text-red-400 mb-3">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </p>
        )}
        <button
          onClick={() => onConfirm(pass)}
          disabled={isLoading || !pass}
          className="w-full rounded-xl bg-[color:var(--veil-glow)] px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
        >
          {isLoading ? "Verifying…" : "Confirm"}
        </button>
      </motion.div>
    </div>
  );
}

// ─── Recovery codes reveal panel ──────────────────────────────────────────────
function RecoveryCodesReveal({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
        <p className="text-xs text-amber-300">
          These codes are shown <strong>exactly once</strong>. Each can be used once to regain access. Store them offline.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {codes.map((code, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
            <span className="text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}.</span>
            <span className="font-mono text-xs text-[color:var(--veil-glow)] select-all">{code}</span>
          </div>
        ))}
      </div>
      <button
        onClick={handleCopy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
      >
        {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <RefreshCw className="h-4 w-4" />}
        {copied ? "Copied!" : "Copy all codes"}
      </button>
      <label className="flex cursor-pointer items-start gap-3 pt-2 border-t border-white/10">
        <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="peer sr-only" />
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-white/20 bg-black/30 mt-0.5 transition peer-checked:border-[color:var(--veil-glow)] peer-checked:bg-[color:var(--veil-glow)]/20">
          {acknowledged && <Check className="h-3.5 w-3.5 text-[color:var(--veil-glow)]" />}
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          I have saved these codes. I understand losing both my passphrase and these codes means <strong className="text-foreground">permanent, unrecoverable account loss</strong>.
        </span>
      </label>
      <button
        onClick={onDone}
        disabled={!acknowledged}
        className="w-full rounded-xl bg-[color:var(--veil-glow)] px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
      >
        Done — codes saved
      </button>
    </motion.div>
  );
}

// ─── Security event icon map ───────────────────────────────────────────────────
const EVENT_ICONS: Record<string, React.ReactNode> = {
  ACCOUNT_CREATED:          <CheckCircle2 className="h-4 w-4 text-green-400" />,
  LOGIN_SUCCESS:            <CheckCircle2 className="h-4 w-4 text-green-400" />,
  LOGIN_TOTP_SUCCESS:       <CheckCircle2 className="h-4 w-4 text-green-400" />,
  PASSKEY_LOGIN_SUCCESS:    <Fingerprint className="h-4 w-4 text-[color:var(--veil-glow)]" />,
  PASSKEY_ADDED:            <Fingerprint className="h-4 w-4 text-[color:var(--veil-glow)]" />,
  PASSKEY_REMOVED:          <Fingerprint className="h-4 w-4 text-amber-400" />,
  TOTP_ENABLED:             <Smartphone className="h-4 w-4 text-green-400" />,
  TOTP_DISABLED:            <Smartphone className="h-4 w-4 text-amber-400" />,
  PASSPHRASE_CHANGED:       <KeyRound className="h-4 w-4 text-[color:var(--veil-glow)]" />,
  RECOVERY_CODE_REDEEMED:   <Shield className="h-4 w-4 text-amber-400" />,
  RECOVERY_CODES_REGENERATED: <RefreshCw className="h-4 w-4 text-[color:var(--veil-glow)]" />,
  LOGOUT_ALL_DEVICES:       <LogOut className="h-4 w-4 text-muted-foreground" />,
  CLONE_DETECTED:           <AlertCircle className="h-4 w-4 text-red-400" />,
};

const EVENT_LABELS: Record<string, string> = {
  ACCOUNT_CREATED:          "Account created",
  LOGIN_SUCCESS:            "Signed in",
  LOGIN_TOTP_SUCCESS:       "Signed in (with 2FA)",
  PASSKEY_LOGIN_SUCCESS:    "Signed in with passkey",
  PASSKEY_ADDED:            "Passkey added",
  PASSKEY_REMOVED:          "Passkey removed",
  TOTP_ENABLED:             "Two-factor auth enabled",
  TOTP_DISABLED:            "Two-factor auth disabled",
  PASSPHRASE_CHANGED:       "Passphrase changed",
  RECOVERY_CODE_REDEEMED:   "Recovery code used",
  RECOVERY_CODES_REGENERATED: "Recovery codes regenerated",
  LOGOUT_ALL_DEVICES:       "All devices signed out",
  CLONE_DETECTED:           "⚠ Cloned passkey detected — passkey revoked",
};

function formatTs(ts: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(ts));
  } catch { return ts; }
}

// ─── Main Profile Component ────────────────────────────────────────────────────
function Profile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = getCurrentUser() || { handle: "anonymous" };

  // ── Passkey state ──
  const [passkeyNickname, setPasskeyNickname] = useState("");
  const [passkeyError, setPasskeyError] = useState("");
  const [passkeySuccess, setPasskeySuccess] = useState("");
  const [removingPasskeyId, setRemovingPasskeyId] = useState<string | null>(null);
  const [removePasskeyModal, setRemovePasskeyModal] = useState<{ id: string; nickname: string } | null>(null);
  const [removePasskeyError, setRemovePasskeyError] = useState("");

  // ── TOTP state ──
  const [totpQr, setTotpQr] = useState<string | null>(null);
  const [totpSetupCode, setTotpSetupCode] = useState("");
  const [totpSetupError, setTotpSetupError] = useState("");
  const [totpSetupSuccess, setTotpSetupSuccess] = useState(false);
  const [disableTotpModal, setDisableTotpModal] = useState(false);
  const [disableTotpError, setDisableTotpError] = useState("");

  // ── Passphrase change ──
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [showCurPass, setShowCurPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");

  // ── Recovery codes ──
  const [regenModal, setRegenModal] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [regenCodes, setRegenCodes] = useState<string[] | null>(null);

  // ── Logout all / Delete ──
  const [logoutAllModal, setLogoutAllModal] = useState(false);
  const [logoutAllError, setLogoutAllError] = useState("");
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: passkeys = [], refetch: refetchPasskeys } = useQuery({
    queryKey: ["passkeys"],
    queryFn: listPasskeys,
  });

  const { data: totpStatus } = useQuery({
    queryKey: ["totp-status"],
    queryFn: getTotpStatus,
  });

  const { data: securityEvents = [] } = useQuery({
    queryKey: ["security-events"],
    queryFn: getSecurityEvents,
  });

  // Fetch full profile to check pendingDeletionAt
  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
  });

  // ─── Passkey mutations ────────────────────────────────────────────────────
  const addPasskeyMut = useMutation({
    mutationFn: async () => {
      const options = await getPasskeyRegisterOptions();
      const credential = await startRegistration({ optionsJSON: options });
      return verifyPasskeyRegistration(credential, passkeyNickname.trim() || undefined);
    },
    onSuccess: () => {
      setPasskeySuccess("Passkey registered successfully.");
      setPasskeyError("");
      setPasskeyNickname("");
      refetchPasskeys();
      qc.invalidateQueries({ queryKey: ["security-events"] });
    },
    onError: (e: any) => setPasskeyError(e.message || "Failed to add passkey."),
  });

  const removePasskeyMut = useMutation({
    mutationFn: async ({ id, passphrase }: { id: string; passphrase: string }) => {
      const { removePasskey } = await import("@/lib/api");
      return removePasskey(id, passphrase);
    },
    onSuccess: () => {
      setRemovePasskeyModal(null);
      setRemovePasskeyError("");
      refetchPasskeys();
      qc.invalidateQueries({ queryKey: ["security-events"] });
    },
    onError: (e: any) => setRemovePasskeyError(e.message || "Failed to remove passkey."),
  });

  // ─── TOTP mutations ────────────────────────────────────────────────────────
  const setupTotpMut = useMutation({
    mutationFn: setupTotp,
    onSuccess: (data) => setTotpQr(data.qrCodeDataUrl),
    onError: (e: any) => setTotpSetupError(e.message || "Failed to start TOTP setup."),
  });

  const enableTotpMut = useMutation({
    mutationFn: (code: string) => enableTotp(code),
    onSuccess: () => {
      setTotpSetupSuccess(true);
      setTotpQr(null);
      setTotpSetupCode("");
      // Bug B8 fix: invalidate each query key separately
      qc.invalidateQueries({ queryKey: ["totp-status"] });
      qc.invalidateQueries({ queryKey: ["security-events"] });
    },
    onError: (e: any) => setTotpSetupError(e.message || "Invalid code."),
  });

  const disableTotpMut = useMutation({
    mutationFn: (passphrase: string) => disableTotp(passphrase),
    onSuccess: () => {
      setDisableTotpModal(false);
      setTotpSetupSuccess(false);
      qc.invalidateQueries({ queryKey: ["totp-status"] });
      qc.invalidateQueries({ queryKey: ["security-events"] });
    },
    onError: (e: any) => setDisableTotpError(e.message || "Failed to disable TOTP."),
  });

  // ─── Passphrase change mutation ───────────────────────────────────────────
  const changePassMut = useMutation({
    mutationFn: () => changePassphrase(curPass, newPass),
    onSuccess: () => {
      setPassSuccess("Passphrase updated. Other sessions have been signed out.");
      setPassError("");
      setCurPass("");
      setNewPass("");
      qc.invalidateQueries({ queryKey: ["security-events"] });
    },
    onError: (e: any) => { setPassError(e.message || "Failed."); setPassSuccess(""); },
  });

  // ─── Recovery code regen mutation ─────────────────────────────────────────
  const regenCodesMut = useMutation({
    mutationFn: (passphrase: string) => regenerateRecoveryCodes(passphrase),
    onSuccess: (data) => {
      setRegenModal(false);
      setRegenCodes(data.recoveryCodes);
      qc.invalidateQueries({ queryKey: ["security-events"] });
    },
    onError: (e: any) => setRegenError(e.message || "Failed to regenerate."),
  });

  // ─── Logout all mutation ──────────────────────────────────────────────────
  const logoutAllMut = useMutation({
    mutationFn: logoutAllDevices,
    onSuccess: () => {
      setLogoutAllModal(false);
      qc.invalidateQueries({ queryKey: ["security-events"] });
    },
    onError: (e: any) => setLogoutAllError(e.message || "Failed."),
  });

  // ─── Delete account mutation ──────────────────────────────────────────────
  const deleteAccMut = useMutation({
    mutationFn: (passphrase: string) => deleteAccount(passphrase),
    onSuccess: () => navigate({ to: "/" }),
    onError: (e: any) => setDeleteError(e.message || "Failed."),
  });

  const isTotpEnabled = totpStatus?.totpEnabled || totpSetupSuccess;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-10 sm:px-6 lg:pt-14">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Profile Settings</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">Your identity. Your keys. Your call.</h1>
      </header>

      {/* Soft-deletion warning banner */}
      {meData?.pendingDeletionAt && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-300">Account scheduled for deletion</p>
            <p className="mt-0.5 text-xs text-amber-300/80">
              Due to inactivity, your account and all its data will be permanently deleted on{" "}
              <strong>
                {new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
                  new Date(meData.pendingDeletionAt)
                )}
              </strong>.
              Simply logging in resets the inactivity timer and cancels this.
            </p>
          </div>
        </div>
      )}

      {/* Avatar Card */}
      <FrostedPanel className="flex items-center gap-5 p-6 mb-6">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl"
          style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--veil) 60%, black), color-mix(in oklab, var(--veil-glow) 30%, black))" }}
        >
          <VeilGlyph className="h-8 w-8 text-white/85" />
        </div>
        <div className="min-w-0 flex-1">
          <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Your handle</label>
          <p className="text-xl font-semibold text-foreground mt-1">@{user.handle}</p>
        </div>
      </FrostedPanel>

      {/* ── Passkeys ──────────────────────────────────────────────────── */}
      <FrostedPanel className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Fingerprint className="h-5 w-5 text-[color:var(--veil-glow)]" />
          <h2 className="font-serif text-2xl">Passkeys</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Sign in with Face ID, fingerprint, or PIN — no passphrase needed. Removing a passkey requires your current passphrase.
        </p>

        {/* Existing passkeys list */}
        {passkeys.length > 0 && (
          <ul className="mb-4 space-y-2">
            {passkeys.map((pk: any) => (
              <li key={pk.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{pk.nickname || "Unnamed passkey"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Added {formatTs(pk.createdAt)}
                    {pk.lastUsedAt && ` · Last used ${formatTs(pk.lastUsedAt)}`}
                  </p>
                </div>
                <button
                  onClick={() => setRemovePasskeyModal({ id: pk.id, nickname: pk.nickname || "this passkey" })}
                  className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/15"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add new passkey */}
        <div className="flex items-center gap-2">
          <input
            value={passkeyNickname}
            onChange={(e) => setPasskeyNickname(e.target.value)}
            placeholder='Nickname (e.g. "MacBook")'
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50"
          />
          <button
            id="add-passkey-btn"
            onClick={() => addPasskeyMut.mutate()}
            disabled={addPasskeyMut.isPending}
            className="rounded-xl bg-[color:var(--veil-glow)] px-4 py-2 text-xs font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
          >
            {addPasskeyMut.isPending ? "Adding…" : "Add passkey"}
          </button>
        </div>
        {passkeyError && <p className="flex items-center gap-1.5 text-xs text-red-400 mt-2"><AlertTriangle className="h-3.5 w-3.5" />{passkeyError}</p>}
        {passkeySuccess && <p className="flex items-center gap-1.5 text-xs text-green-400 mt-2"><Check className="h-3.5 w-3.5" />{passkeySuccess}</p>}
      </FrostedPanel>

      {/* ── Two-Factor Authentication (TOTP) ────────────────────────── */}
      <FrostedPanel className="p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-[color:var(--veil-glow)]" />
            <h2 className="font-serif text-2xl">Two-Factor Auth</h2>
          </div>
          <span className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            isTotpEnabled
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-white/5 text-muted-foreground border border-white/10"
          )}>
            {isTotpEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Use an authenticator app (Google Authenticator, Authy, Bitwarden) for a second login factor.
        </p>

        {!isTotpEnabled && !totpQr && (
          <button
            onClick={() => setupTotpMut.mutate()}
            disabled={setupTotpMut.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--veil-glow)]/10 border border-[color:var(--veil-glow)]/20 px-4 py-2.5 text-sm text-[color:var(--veil-glow)] transition hover:bg-[color:var(--veil-glow)]/20 disabled:opacity-40"
          >
            <QrCode className="h-4 w-4" />
            {setupTotpMut.isPending ? "Generating…" : "Set up TOTP"}
          </button>
        )}

        {/* QR code + verify step */}
        {totpQr && !isTotpEnabled && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <p className="text-sm">Scan with your authenticator app, then enter a code to confirm:</p>
            <div className="flex justify-center">
              <img src={totpQr} alt="TOTP QR Code" className="h-44 w-44 rounded-xl border border-white/10 bg-white p-2" />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="totp-verify-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpSetupCode}
                onChange={(e) => setTotpSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-center font-mono text-lg tracking-widest outline-none placeholder:text-muted-foreground/50"
              />
              <button
                onClick={() => enableTotpMut.mutate(totpSetupCode)}
                disabled={enableTotpMut.isPending || totpSetupCode.length !== 6}
                className="rounded-xl bg-[color:var(--veil-glow)] px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
              >
                {enableTotpMut.isPending ? "Verifying…" : "Activate"}
              </button>
            </div>
            {totpSetupError && <p className="flex items-center gap-1.5 text-xs text-red-400"><AlertTriangle className="h-3.5 w-3.5" />{totpSetupError}</p>}
          </motion.div>
        )}

        {isTotpEnabled && (
          <button
            onClick={() => { setDisableTotpModal(true); setDisableTotpError(""); }}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-sm text-amber-400 transition hover:bg-amber-500/10"
          >
            <X className="h-4 w-4" />
            Disable TOTP
          </button>
        )}
      </FrostedPanel>

      {/* ── Change Passphrase ────────────────────────────────────────── */}
      <FrostedPanel className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Key className="h-5 w-5 text-[color:var(--veil-glow)]" />
          <h2 className="font-serif text-2xl">Change Passphrase</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Changing your passphrase invalidates all other active sessions. Must be ≥60 bits of entropy and not found in known breaches.
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
            <label htmlFor="current-passphrase-change" className="sr-only">Current passphrase</label>
            <input
              id="current-passphrase-change"
              type={showCurPass ? "text" : "password"}
              value={curPass}
              onChange={(e) => setCurPass(e.target.value)}
              placeholder="Current passphrase"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            />
            <button onClick={() => setShowCurPass((v) => !v)} className="text-muted-foreground" aria-label={showCurPass ? "Hide passphrase" : "Show passphrase"}>
              {showCurPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
            <label htmlFor="new-passphrase-change" className="sr-only">New passphrase</label>
            <input
              id="new-passphrase-change"
              type={showNewPass ? "text" : "password"}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="New passphrase (strong)"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            />
            <button onClick={() => setShowNewPass((v) => !v)} className="text-muted-foreground" aria-label={showNewPass ? "Hide new passphrase" : "Show new passphrase"}>
              {showNewPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <button
            id="change-passphrase-btn"
            onClick={() => changePassMut.mutate()}
            disabled={changePassMut.isPending || !curPass || !newPass}
            className="rounded-xl bg-[color:var(--veil-glow)] px-4 py-2 text-xs font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
          >
            {changePassMut.isPending ? "Updating…" : "Update passphrase"}
          </button>
          {passError && <p className="flex items-center gap-1.5 text-xs text-red-400"><AlertTriangle className="h-3.5 w-3.5" />{passError}</p>}
          {passSuccess && <p className="flex items-center gap-1.5 text-xs text-green-400"><Check className="h-3.5 w-3.5" />{passSuccess}</p>}
        </div>
      </FrostedPanel>

      {/* ── Recovery Codes ───────────────────────────────────────────── */}
      <FrostedPanel className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Shield className="h-5 w-5 text-[color:var(--veil-glow)]" />
          <h2 className="font-serif text-2xl">Recovery Codes</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          If you lose your passphrase, recovery codes are your only way back in. Regenerating invalidates all previous codes.
        </p>
        {regenCodes ? (
          <RecoveryCodesReveal codes={regenCodes} onDone={() => setRegenCodes(null)} />
        ) : (
          <button
            id="regen-codes-btn"
            onClick={() => { setRegenModal(true); setRegenError(""); }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerate recovery codes
          </button>
        )}
      </FrostedPanel>

      {/* ── Log Out All Devices ──────────────────────────────────────── */}
      <FrostedPanel className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <LogOut className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-serif text-2xl">Active Sessions</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Invalidate all tokens on every device. You will remain signed in on this device with a fresh token.
        </p>
        <button
          id="logout-all-btn"
          onClick={() => { setLogoutAllModal(true); setLogoutAllError(""); }}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out all other devices
        </button>
      </FrostedPanel>

      {/* ── Security Event Timeline ──────────────────────────────────── */}
      <FrostedPanel className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Activity className="h-5 w-5 text-[color:var(--veil-glow)]" />
          <h2 className="font-serif text-2xl">Security Events</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          All security-relevant actions on your account — the anonymity-preserving substitute for email alerts.
        </p>
        {securityEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events recorded yet.</p>
        ) : (
          <ul className="space-y-px">
            {securityEvents.slice(0, 20).map((ev: any) => (
              <li key={ev.id} className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
                <span className="mt-0.5 shrink-0">{EVENT_ICONS[ev.type] ?? <Info className="h-4 w-4 text-muted-foreground" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{EVENT_LABELS[ev.type] ?? ev.type}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatTs(ev.createdAt)}
                    {ev.deviceFingerprintHash && (
                      <span className="ml-2 font-mono opacity-50" title="Anonymised device fingerprint">
                        #{ev.deviceFingerprintHash.slice(0, 8)}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </FrostedPanel>

      {/* ── Danger Zone ─────────────────────────────────────────────── */}
      <FrostedPanel className="border-red-500/20 bg-red-500/[0.02] p-6 mb-8">
        <div className="flex items-center gap-3 mb-1">
          <ShieldAlert className="h-5 w-5 text-red-500" />
          <h2 className="font-serif text-2xl text-red-400">Danger Zone</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Permanently delete your account. This purges your handle, posts, comments, and messages. Unrecoverable.
        </p>
        <button
          id="delete-account-btn"
          onClick={() => { setDeleteModal(true); setDeleteError(""); }}
          disabled={deleteAccMut.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-5 py-3 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          {deleteAccMut.isPending ? "Purging…" : "Permanently Delete Account"}
        </button>
      </FrostedPanel>

      {/* ── Privacy data list ─────────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--veil-glow)]">Data & Privacy</p>
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

      {/* ─── Modals ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {/* Remove passkey modal */}
        {removePasskeyModal && (
          <PassphraseModal
            title={`Remove "${removePasskeyModal.nickname}"?`}
            description="Enter your passphrase to confirm passkey removal."
            isLoading={removePasskeyMut.isPending}
            error={removePasskeyError}
            onClose={() => { setRemovePasskeyModal(null); setRemovePasskeyError(""); }}
            onConfirm={(passphrase) => removePasskeyMut.mutate({ id: removePasskeyModal.id, passphrase })}
          />
        )}

        {/* Disable TOTP modal */}
        {disableTotpModal && (
          <PassphraseModal
            title="Disable two-factor auth?"
            description="Enter your passphrase to disable TOTP. Your account will only be protected by your passphrase."
            isLoading={disableTotpMut.isPending}
            error={disableTotpError}
            onClose={() => { setDisableTotpModal(false); setDisableTotpError(""); }}
            onConfirm={(passphrase) => disableTotpMut.mutate(passphrase)}
          />
        )}

        {/* Regenerate recovery codes modal */}
        {regenModal && (
          <PassphraseModal
            title="Regenerate recovery codes?"
            description="Old codes will be permanently invalidated. Enter your passphrase to continue."
            isLoading={regenCodesMut.isPending}
            error={regenError}
            onClose={() => setRegenModal(false)}
            onConfirm={(passphrase) => regenCodesMut.mutate(passphrase)}
          />
        )}

        {/* Logout all modal */}
        {logoutAllModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-[color:var(--ink)] p-6 shadow-2xl"
            >
              <h3 className="font-serif text-xl mb-2">Sign out all devices?</h3>
              <p className="text-xs text-muted-foreground mb-4">
                All sessions on other devices will be immediately invalidated. You will stay signed in here with a new token.
              </p>
              {logoutAllError && <p className="text-xs text-red-400 mb-3 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />{logoutAllError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setLogoutAllModal(false)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-muted-foreground hover:text-foreground transition">Cancel</button>
                <button
                  id="confirm-logout-all-btn"
                  onClick={() => logoutAllMut.mutate()}
                  disabled={logoutAllMut.isPending}
                  className="flex-1 rounded-xl bg-[color:var(--veil-glow)] py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
                >
                  {logoutAllMut.isPending ? "Signing out…" : "Sign out all"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete account modal */}
        {deleteModal && (
          <PassphraseModal
            title="Permanently delete account?"
            description="This is irreversible. Enter your passphrase to confirm deletion of all your data."
            isLoading={deleteAccMut.isPending}
            error={deleteError}
            onClose={() => setDeleteModal(false)}
            onConfirm={(passphrase) => deleteAccMut.mutate(passphrase)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
