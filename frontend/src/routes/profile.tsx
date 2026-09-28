import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  KeyRound,
  AlertTriangle,
  ShieldAlert,
  Trash2,
  Key,
  Check,
  Fingerprint,
  QrCode,
  RefreshCw,
  LogOut,
  Clock,
  Shield,
  ChevronRight,
  X,
  Eye,
  EyeOff,
  Smartphone,
  Activity,
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
  Bell,
  Mail,
  Crown,
  Zap,
  Radio,
  Share2,
  MessageSquare,
  Lock,
  Cpu,
  Layers,
  Heart,
  PlusCircle,
  Settings,
  ShieldCheck,
  ExternalLink,
  Copy,
} from "lucide-react";
import { FrostedPanel } from "@/components/veil/FrostedPanel";
import { SocialSpaceEmblem } from "@/components/veil/SocialSpaceEmblem";
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
  fetchFeed,
  deletePost,
} from "@/lib/api";
import { startRegistration } from "@simplewebauthn/browser";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/profile")({
  validateSearch: (search: Record<string, unknown>): { premium?: boolean } => {
    return {
      premium:
        search.premium === "true" || search.premium === true ? true : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Profile & Sovereign Vault — Social Space" },
      {
        name: "description",
        content:
          "Manage your pseudonym persona, cryptographic passkeys, two-factor auth, live broadcasts, and data sovereignty.",
      },
    ],
  }),
  component: Profile,
});

/* ─── Avatar Theme Presets ─────────────────────────────────────────────────── */
const AVATAR_THEMES = [
  {
    id: "gold",
    name: "Cyber Gold",
    color: "#f59e0b",
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.25)]",
  },
  {
    id: "purple",
    name: "Cosmic Violet",
    color: "#a855f7",
    border: "border-purple-500/40",
    bg: "bg-purple-500/10",
    glow: "shadow-[0_0_20px_rgba(168,85,247,0.25)]",
  },
  {
    id: "emerald",
    name: "Matrix Emerald",
    color: "#10b981",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.25)]",
  },
  {
    id: "cyan",
    name: "Quantum Cyan",
    color: "#06b6d4",
    border: "border-cyan-500/40",
    bg: "bg-cyan-500/10",
    glow: "shadow-[0_0_20px_rgba(6,182,212,0.25)]",
  },
  {
    id: "rose",
    name: "Solar Flare",
    color: "#f43f5e",
    border: "border-rose-500/40",
    bg: "bg-rose-500/10",
    glow: "shadow-[0_0_20px_rgba(244,63,94,0.25)]",
  },
];

/* ─── Helper: Step-Up Passphrase Modal ─────────────────────────────────────── */
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0d121c] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-serif text-xl text-white font-bold">{title}</h3>
            <p className="text-xs text-white/60 mt-1">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 mb-3 rounded-xl border border-white/10 bg-white/5">
          <KeyRound className="h-4 w-4 text-white/50 shrink-0" />
          <input
            autoFocus
            type={show ? "text" : "password"}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Current sovereign passphrase"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            onKeyDown={(e) => e.key === "Enter" && pass && onConfirm(pass)}
          />
          <button
            onClick={() => setShow((v) => !v)}
            className="text-white/50 hover:text-white"
          >
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
          className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black transition disabled:opacity-40"
        >
          {isLoading ? "Cryptographically Verifying…" : "Confirm Identity"}
        </button>
      </motion.div>
    </div>
  );
}

/* ─── Recovery Codes Reveal Panel ─────────────────────────────────────────── */
function RecoveryCodesReveal({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
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
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
        <p className="text-xs text-amber-300 leading-relaxed">
          These recovery ciphers are shown <strong>exactly once</strong>. Each code can be redeemed once to restore access if your passphrase is lost. Keep them offline in a physical vault.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {codes.map((code, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-amber-300 select-all"
          >
            <span className="text-[10px] text-white/40 w-4 shrink-0">{i + 1}.</span>
            <span className="tracking-wide">{code}</span>
          </div>
        ))}
      </div>

      <button
        onClick={handleCopy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition"
      >
        {copied ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        {copied ? "All Ciphers Copied" : "Copy All Recovery Codes"}
      </button>

      <label className="flex cursor-pointer items-start gap-3 pt-2 border-t border-white/10">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="peer sr-only"
        />
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-white/20 bg-black/30 mt-0.5 transition peer-checked:border-amber-400 peer-checked:bg-amber-500/20">
          {acknowledged && <Check className="h-3.5 w-3.5 text-amber-400" />}
        </span>
        <span className="text-xs leading-relaxed text-white/70">
          I have safely vaulted these recovery codes. I acknowledge that losing both my passphrase and recovery keys results in <strong className="text-white">permanent, irreversible loss of this sovereign node</strong>.
        </span>
      </label>

      <button
        onClick={onDone}
        disabled={!acknowledged}
        className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black transition disabled:opacity-40"
      >
        Vault Secured — Complete
      </button>
    </motion.div>
  );
}

/* ─── Security Event Timeline Icons & Labels ──────────────────────────────── */
const EVENT_ICONS: Record<string, React.ReactNode> = {
  ACCOUNT_CREATED: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  LOGIN_SUCCESS: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  LOGIN_TOTP_SUCCESS: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  PASSKEY_LOGIN_SUCCESS: <Fingerprint className="h-4 w-4 text-amber-400" />,
  PASSKEY_ADDED: <Fingerprint className="h-4 w-4 text-amber-400" />,
  PASSKEY_REMOVED: <Fingerprint className="h-4 w-4 text-amber-400" />,
  TOTP_ENABLED: <Smartphone className="h-4 w-4 text-emerald-400" />,
  TOTP_DISABLED: <Smartphone className="h-4 w-4 text-amber-400" />,
  PASSPHRASE_CHANGED: <KeyRound className="h-4 w-4 text-amber-400" />,
  RECOVERY_CODE_REDEEMED: <Shield className="h-4 w-4 text-amber-400" />,
  RECOVERY_CODES_REGENERATED: <RefreshCw className="h-4 w-4 text-amber-400" />,
  LOGOUT_ALL_DEVICES: <LogOut className="h-4 w-4 text-white/50" />,
  CLONE_DETECTED: <AlertCircle className="h-4 w-4 text-red-400" />,
};

const EVENT_LABELS: Record<string, string> = {
  ACCOUNT_CREATED: "Sovereign node initialized",
  LOGIN_SUCCESS: "Authenticated session started",
  LOGIN_TOTP_SUCCESS: "Authenticated with hardware 2FA",
  PASSKEY_LOGIN_SUCCESS: "Authenticated via biometric passkey",
  PASSKEY_ADDED: "Biometric passkey enrolled",
  PASSKEY_REMOVED: "Biometric passkey revoked",
  TOTP_ENABLED: "Two-factor authentication activated",
  TOTP_DISABLED: "Two-factor authentication disabled",
  PASSPHRASE_CHANGED: "Cryptographic passphrase rotated",
  RECOVERY_CODE_REDEEMED: "One-time recovery cipher used",
  RECOVERY_CODES_REGENERATED: "New recovery key vault issued",
  LOGOUT_ALL_DEVICES: "All remote sessions invalidated",
  CLONE_DETECTED: "⚠ Cloned passkey detected — hardware token revoked",
};

function formatTs(ts: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

/* ─── Main Profile Component ──────────────────────────────────────────────── */
function Profile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = getCurrentUser() || { handle: "anonymous" };

  // Profile tabs state
  const [activeTab, setActiveTab] = useState<
    "overview" | "transmissions" | "security" | "sessions" | "danger"
  >("overview");

  // Avatar theme customization
  const [avatarTheme, setAvatarTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("veil_avatar_theme") || "gold";
    }
    return "gold";
  });

  const selectAvatarTheme = (themeId: string) => {
    setAvatarTheme(themeId);
    if (typeof window !== "undefined") {
      localStorage.setItem("veil_avatar_theme", themeId);
    }
  };

  const currentThemeObj =
    AVATAR_THEMES.find((t) => t.id === avatarTheme) || AVATAR_THEMES[0];

  // Premium modal state
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [premiumToast, setPremiumToast] = useState<string | null>(null);
  const premiumModalRef = useRef<HTMLDivElement>(null);
  const joinBtnRef = useRef<HTMLButtonElement>(null);
  const search = Route.useSearch();

  useEffect(() => {
    if (search.premium) {
      setShowPremiumModal(true);
    }
  }, [search.premium]);

  const closePremiumModal = useCallback(() => {
    setShowPremiumModal(false);
  }, []);

  const handleJoinWaitlist = useCallback(async () => {
    setWaitlistJoined(true);
    await new Promise((r) => setTimeout(r, 500));
    closePremiumModal();
    setTimeout(
      () =>
        setPremiumToast(
          "✓ Sovereign waitlist registered! We'll notify your node when Premium launches.",
        ),
      200,
    );
  }, [closePremiumModal]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      qc.clear();
      navigate({ to: "/" });
    } catch (e) {
      console.error(e);
    }
  };

  // ── Passkey state ──
  const [passkeyNickname, setPasskeyNickname] = useState("");
  const [passkeyError, setPasskeyError] = useState("");
  const [passkeySuccess, setPasskeySuccess] = useState("");
  const [removePasskeyModal, setRemovePasskeyModal] = useState<{
    id: string;
    nickname: string;
  } | null>(null);
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

  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
  });

  // Query User's Own Posts in Real-Time
  const { data: myPosts = [], isLoading: isLoadingMyPosts } = useQuery({
    queryKey: ["my-posts", user.handle],
    queryFn: () => fetchFeed(undefined, 1, { handle: user.handle }),
    enabled: !!user.handle && user.handle !== "anonymous",
  });

  // ─── Real-Time Delete Post Mutation ───────────────────────────────────────
  const deletePostMut = useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-posts"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  // ─── Passkey mutations ────────────────────────────────────────────────────
  const addPasskeyMut = useMutation({
    mutationFn: async () => {
      const options = await getPasskeyRegisterOptions();
      const credential = await startRegistration({ optionsJSON: options });
      return verifyPasskeyRegistration(
        credential,
        passkeyNickname.trim() || undefined,
      );
    },
    onSuccess: () => {
      setPasskeySuccess("Biometric passkey enrolled successfully.");
      setPasskeyError("");
      setPasskeyNickname("");
      refetchPasskeys();
      qc.invalidateQueries({ queryKey: ["security-events"] });
    },
    onError: (e: any) => setPasskeyError(e.message || "Failed to add passkey."),
  });

  const removePasskeyMut = useMutation({
    mutationFn: async ({
      id,
      passphrase,
    }: {
      id: string;
      passphrase: string;
    }) => {
      const { removePasskey } = await import("@/lib/api");
      return removePasskey(id, passphrase);
    },
    onSuccess: () => {
      setRemovePasskeyModal(null);
      setRemovePasskeyError("");
      refetchPasskeys();
      qc.invalidateQueries({ queryKey: ["security-events"] });
    },
    onError: (e: any) =>
      setRemovePasskeyError(e.message || "Failed to remove passkey."),
  });

  // ─── TOTP mutations ────────────────────────────────────────────────────────
  const setupTotpMut = useMutation({
    mutationFn: setupTotp,
    onSuccess: (data) => setTotpQr(data.qrCodeDataUrl),
    onError: (e: any) =>
      setTotpSetupError(e.message || "Failed to start TOTP setup."),
  });

  const enableTotpMut = useMutation({
    mutationFn: (code: string) => enableTotp(code),
    onSuccess: () => {
      setTotpSetupSuccess(true);
      setTotpQr(null);
      setTotpSetupCode("");
      qc.invalidateQueries({ queryKey: ["totp-status"] });
      qc.invalidateQueries({ queryKey: ["security-events"] });
    },
    onError: (e: any) => setTotpSetupError(e.message || "Invalid authentication code."),
  });

  const disableTotpMut = useMutation({
    mutationFn: (passphrase: string) => disableTotp(passphrase),
    onSuccess: () => {
      setDisableTotpModal(false);
      setTotpSetupSuccess(false);
      qc.invalidateQueries({ queryKey: ["totp-status"] });
      qc.invalidateQueries({ queryKey: ["security-events"] });
    },
    onError: (e: any) =>
      setDisableTotpError(e.message || "Failed to disable TOTP."),
  });

  // ─── Passphrase change mutation ───────────────────────────────────────────
  const changePassMut = useMutation({
    mutationFn: () => changePassphrase(curPass, newPass),
    onSuccess: () => {
      setPassSuccess(
        "Passphrase rotated. All other active sessions have been securely signed out.",
      );
      setPassError("");
      setCurPass("");
      setNewPass("");
      qc.invalidateQueries({ queryKey: ["security-events"] });
    },
    onError: (e: any) => {
      setPassError(e.message || "Failed to update passphrase.");
      setPassSuccess("");
    },
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
    onError: (e: any) => setLogoutAllError(e.message || "Failed to invalidate sessions."),
  });

  // ─── Delete account mutation ──────────────────────────────────────────────
  const deleteAccMut = useMutation({
    mutationFn: (passphrase: string) => deleteAccount(passphrase),
    onSuccess: () => navigate({ to: "/" }),
    onError: (e: any) => setDeleteError(e.message || "Failed to purge account."),
  });

  const isTotpEnabled = totpStatus?.totpEnabled || totpSetupSuccess;

  // Calculate dynamic cryptographic security score
  const hasPasskey = passkeys.length > 0;
  let securityScore = 30; // base score for hashed master passphrase
  if (hasPasskey) securityScore += 35;
  if (isTotpEnabled) securityScore += 35;

  return (
    <div className="cosmic-theme min-h-screen text-white mx-auto max-w-4xl px-4 pb-36 lg:pb-20 pt-8 sm:px-6">
      {/* Soft-deletion warning banner */}
      {meData?.pendingDeletionAt && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 backdrop-blur-xl">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-300">
              Sovereign Account Scheduled for Deletion
            </p>
            <p className="mt-0.5 text-xs text-amber-300/80 leading-relaxed">
              Due to inactivity, this node is scheduled to be permanently purged on{" "}
              <strong>
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "long",
                }).format(new Date(meData.pendingDeletionAt))}
              </strong>
              . Signing in resets your inactivity timer.
            </p>
          </div>
        </div>
      )}

      {/* ─── Hero Sovereign Identity Card ───────────────────────────────────── */}
      <FrostedPanel className="p-6 sm:p-8 mb-8 rounded-[32px] border border-white/10 bg-[#0c1017]/85 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        {/* Ambient atmospheric backlight */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-[90px] opacity-25"
          style={{ backgroundColor: currentThemeObj.color }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5 min-w-0">
            {/* Holographic Persona Emblem */}
            <div
              className={cn(
                "relative grid h-20 w-20 shrink-0 place-items-center rounded-3xl border transition-all duration-300",
                currentThemeObj.bg,
                currentThemeObj.border,
                currentThemeObj.glow,
              )}
            >
              <SocialSpaceEmblem size={46} />
              <div
                className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-[#0c1017] flex items-center justify-center shadow"
                style={{ backgroundColor: currentThemeObj.color }}
              >
                <Check className="h-3 w-3 text-black stroke-[3]" />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  <ShieldCheck className="h-3 w-3" />
                  Sovereign Node
                </span>
                <span className="text-[10px] text-white/40 font-mono">
                  ECDH-P256 Active
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 truncate">
                @{user.handle}
              </h1>

              <div className="flex items-center gap-4 mt-2 text-xs text-white/50">
                <span className="flex items-center gap-1">
                  <Radio className="h-3.5 w-3.5 text-amber-400" />
                  {myPosts.length} Broadcasts
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-white/40" />
                  Zero Telemetry
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Sign Out */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowPremiumModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition active:scale-95"
            >
              <Crown className="h-3.5 w-3.5 text-amber-400" />
              Upgrade
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white hover:border-red-500/40 active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>

        {/* Security Integrity Gauge Meter */}
        <div className="mt-7 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold text-white/80 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-amber-400" />
                Cryptographic Shield Integrity
              </span>
              <span
                className="font-mono font-bold"
                style={{
                  color:
                    securityScore >= 90
                      ? "#10b981"
                      : securityScore >= 60
                        ? "#f59e0b"
                        : "#f43f5e",
                }}
              >
                {securityScore}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${securityScore}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full transition-all",
                  securityScore >= 90
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                    : securityScore >= 60
                      ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                      : "bg-gradient-to-r from-red-500 to-rose-400",
                )}
              />
            </div>
          </div>

          {/* Quick status pill */}
          <div className="flex items-center gap-2 text-xs text-white/60">
            {securityScore >= 90 ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Fortified (Passkey + 2FA Active)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <AlertCircle className="h-3.5 w-3.5" /> Passkey or 2FA Recommended
              </span>
            )}
          </div>
        </div>
      </FrostedPanel>

      {/* ─── Sleek Tab Navigation Bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-8 no-scrollbar border-b border-white/10">
        {[
          { id: "overview", label: "Overview & Persona", icon: Layers },
          {
            id: "transmissions",
            label: `My Broadcasts (${myPosts.length})`,
            icon: Radio,
          },
          { id: "security", label: "Sovereign Vault", icon: Shield },
          { id: "sessions", label: "Sessions & Audit", icon: Activity },
          { id: "danger", label: "Danger Zone", icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all duration-200",
                isActive
                  ? "bg-amber-500 text-black shadow-[0_0_18px_rgba(245,158,11,0.3)]"
                  : "text-white/60 hover:text-white hover:bg-white/5",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: OVERVIEW & PERSONA ───────────────────────────────────────── */}
      {activeTab === "overview" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Avatar Glyph Customizer */}
          <FrostedPanel className="p-6 rounded-3xl border border-white/10 bg-[#0c1017]/80">
            <h2 className="font-serif text-xl font-bold text-white mb-1">
              Persona Resonance & Glyph Theme
            </h2>
            <p className="text-xs text-white/50 mb-5">
              Select your node's cryptographic color signature. This applies to your local cipher environment and ambient glows.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {AVATAR_THEMES.map((theme) => {
                const isSelected = avatarTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => selectAvatarTheme(theme.id)}
                    className={cn(
                      "flex flex-col items-center gap-2.5 p-3.5 rounded-2xl border transition-all duration-200",
                      isSelected
                        ? "border-amber-400 bg-white/10 shadow-lg"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/5",
                    )}
                  >
                    <div
                      className="h-8 w-8 rounded-full border shadow-inner flex items-center justify-center"
                      style={{ backgroundColor: theme.color, borderColor: "rgba(255,255,255,0.3)" }}
                    >
                      {isSelected && <Check className="h-4 w-4 text-black stroke-[3]" />}
                    </div>
                    <span className="text-[11px] font-semibold text-white/90">
                      {theme.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </FrostedPanel>

          {/* Cryptographic Key Details Card */}
          <FrostedPanel className="p-6 rounded-3xl border border-white/10 bg-[#0c1017]/80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-white">
                  ECDH Chat Public Key
                </h3>
                <p className="text-xs text-white/50">
                  Used by contacts to negotiate ephemeral end-to-end secret chat keys.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-mono">
                ECDH-P256
              </span>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3 flex items-center justify-between font-mono text-xs text-amber-300">
              <span className="truncate mr-3 select-all">
                {meData?.chatPublicKey || "0478bf1e32ad4c90e... (Auto-Generated Ephemeral Key)"}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    meData?.chatPublicKey || "0478bf1e32ad4c90e",
                  );
                }}
                className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition shrink-0"
                title="Copy public key"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </FrostedPanel>

          {/* Zero Data Charter Summary */}
          <FrostedPanel className="p-6 rounded-3xl border border-white/10 bg-[#0c1017]/80">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              <h3 className="font-serif text-lg font-bold text-white">
                Sovereign Data Guarantee
              </h3>
            </div>
            <p className="text-xs text-white/60 mb-4 leading-relaxed">
              Social Space is engineered to never collect, store, or profile your personal life.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {[
                "Zero Legal Name or Government ID",
                "Zero Email or Phone Number Requirements",
                "Zero Device Identifiers or Ad Trackers",
                "Zero Geolocation or IP Logging",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-white/80"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </FrostedPanel>
        </motion.div>
      )}

      {/* ─── TAB 2: MY TRANSMISSIONS (REAL-TIME POSTS) ───────────────────────── */}
      {activeTab === "transmissions" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="font-serif text-xl font-bold text-white">
                Your Published Transmissions
              </h2>
              <p className="text-xs text-white/50">
                Signals authored by your sovereign pseudonym. You can review or delete them in real time.
              </p>
            </div>
            <Link
              to="/compose"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black px-3.5 py-2 text-xs font-bold transition shadow-[0_0_15px_rgba(245,158,11,0.25)]"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              New Signal
            </Link>
          </div>

          {isLoadingMyPosts ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl bg-white/5 border border-white/10"
                />
              ))}
            </div>
          ) : myPosts.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#0c1017]/80 p-10 text-center flex flex-col items-center">
              <Radio className="h-10 w-10 text-amber-400/50 mb-3 animate-pulse" />
              <p className="text-sm font-bold text-white">No active transmissions</p>
              <p className="text-xs text-white/50 mt-1 mb-5 max-w-xs">
                You haven't authored any transmissions under this pseudonym yet.
              </p>
              <Link
                to="/compose"
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 transition"
              >
                Create First Transmission
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myPosts.map((post: any) => (
                <FrostedPanel
                  key={post.id}
                  className="p-5 rounded-2xl border border-white/10 bg-[#0c1017]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono">
                        {post.topic || "Signal"}
                      </span>
                      <span className="text-[10px] text-white/40">{post.time}</span>
                      {post.media && (
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-[10px]">
                          Media Attached
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/90 line-clamp-2 leading-relaxed">
                      {post.body}
                    </p>
                    <div className="flex items-center gap-4 mt-2.5 text-xs text-white/50">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5 text-amber-400" />
                        {post.reactions}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5 text-white/40" />
                        {post.replies}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to="/social"
                      search={{ highlight: post.id }}
                      className="p-2 rounded-xl border border-white/10 hover:bg-white/10 text-white/70 hover:text-white transition text-xs flex items-center gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View
                    </Link>
                    <button
                      onClick={() => {
                        if (confirm("Permanently delete this transmission?")) {
                          deletePostMut.mutate(post.id);
                        }
                      }}
                      disabled={deletePostMut.isPending}
                      className="p-2 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition text-xs flex items-center gap-1"
                      title="Delete transmission"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </FrostedPanel>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ─── TAB 3: SOVEREIGN SECURITY & PASSKEYS ─────────────────────────────── */}
      {activeTab === "security" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Biometric Passkeys Panel */}
          <FrostedPanel className="p-6 rounded-3xl border border-white/10 bg-[#0c1017]/80">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <Fingerprint className="h-5 w-5 text-amber-400" />
                <h2 className="font-serif text-xl font-bold text-white">
                  Biometric Passkeys
                </h2>
              </div>
              <span className="text-xs text-amber-400 font-mono">
                {passkeys.length} Registered
              </span>
            </div>
            <p className="text-xs text-white/50 mb-5 leading-relaxed">
              Hardware-bound cryptographic credentials. Sign in via Face ID, Touch ID, Windows Hello, or FIDO2 hardware keys without transmitting secrets.
            </p>

            {/* Existing passkeys list */}
            {passkeys.length > 0 && (
              <ul className="mb-4 space-y-2">
                {passkeys.map((pk: any) => (
                  <li
                    key={pk.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {pk.nickname || "Cryptographic Key"}
                      </p>
                      <p className="text-[11px] text-white/40 mt-0.5">
                        Enrolled {formatTs(pk.createdAt)}
                        {pk.lastUsedAt && ` • Active ${formatTs(pk.lastUsedAt)}`}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setRemovePasskeyModal({
                          id: pk.id,
                          nickname: pk.nickname || "this key",
                        })
                      }
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/20"
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add passkey input */}
            <div className="flex items-center gap-2">
              <input
                value={passkeyNickname}
                onChange={(e) => setPasskeyNickname(e.target.value)}
                placeholder='Hardware Nickname (e.g. "TouchID MacBook", "YubiKey 5")'
                className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-white/10 bg-white/5 text-white outline-none focus:border-amber-400"
              />
              <button
                id="add-passkey-btn"
                onClick={() => addPasskeyMut.mutate()}
                disabled={addPasskeyMut.isPending}
                className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-bold text-black transition disabled:opacity-40 shrink-0"
              >
                {addPasskeyMut.isPending ? "Prompting Hardware…" : "Enroll Passkey"}
              </button>
            </div>
            {passkeyError && (
              <p className="flex items-center gap-1.5 text-xs text-red-400 mt-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                {passkeyError}
              </p>
            )}
            {passkeySuccess && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-400 mt-2">
                <Check className="h-3.5 w-3.5" />
                {passkeySuccess}
              </p>
            )}
          </FrostedPanel>

          {/* Two-Factor Authentication (TOTP) */}
          <FrostedPanel className="p-6 rounded-3xl border border-white/10 bg-[#0c1017]/80">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-amber-400" />
                <h2 className="font-serif text-xl font-bold text-white">
                  Two-Factor Authentication (TOTP)
                </h2>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  isTotpEnabled
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/5 text-white/50 border border-white/10",
                )}
              >
                {isTotpEnabled ? "Active" : "Disabled"}
              </span>
            </div>
            <p className="text-xs text-white/50 mb-5 leading-relaxed">
              Pair any offline authenticator app (Google Authenticator, Bitwarden, Ente Auth, 1Password) for hardware-isolated time-based one-time codes.
            </p>

            {!isTotpEnabled && !totpQr && (
              <button
                onClick={() => setupTotpMut.mutate()}
                disabled={setupTotpMut.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-40"
              >
                <QrCode className="h-4 w-4" />
                {setupTotpMut.isPending ? "Generating Cipher Key…" : "Configure Authenticator App"}
              </button>
            )}

            {/* QR code setup flow */}
            {totpQr && !isTotpEnabled && (
              <div className="space-y-4 border-t border-white/10 pt-4">
                <p className="text-xs text-white/80">
                  Scan this QR code in your authenticator app, then enter the 6-digit confirmation code:
                </p>
                <div className="flex justify-center">
                  <img
                    src={totpQr}
                    alt="TOTP QR Code"
                    className="h-44 w-44 rounded-2xl border border-white/10 bg-white p-2.5 shadow-2xl"
                  />
                </div>
                <div className="flex items-center gap-2 max-w-sm mx-auto">
                  <input
                    id="totp-verify-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpSetupCode}
                    onChange={(e) =>
                      setTotpSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    className="flex-1 px-3 py-2.5 text-center font-mono text-lg tracking-widest rounded-xl border border-white/10 bg-white/5 text-white focus:border-amber-400 outline-none"
                  />
                  <button
                    onClick={() => enableTotpMut.mutate(totpSetupCode)}
                    disabled={enableTotpMut.isPending || totpSetupCode.length !== 6}
                    className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-xs font-bold text-black transition disabled:opacity-40"
                  >
                    {enableTotpMut.isPending ? "Verifying…" : "Activate 2FA"}
                  </button>
                </div>
                {totpSetupError && (
                  <p className="text-center text-xs text-red-400">
                    {totpSetupError}
                  </p>
                )}
              </div>
            )}

            {isTotpEnabled && (
              <button
                onClick={() => {
                  setDisableTotpModal(true);
                  setDisableTotpError("");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
              >
                <X className="h-4 w-4" />
                Deactivate 2FA
              </button>
            )}
          </FrostedPanel>

          {/* Passphrase Rotation */}
          <FrostedPanel className="p-6 rounded-3xl border border-white/10 bg-[#0c1017]/80">
            <div className="flex items-center gap-3 mb-1">
              <Key className="h-5 w-5 text-amber-400" />
              <h2 className="font-serif text-xl font-bold text-white">
                Rotate Master Passphrase
              </h2>
            </div>
            <p className="text-xs text-white/50 mb-5 leading-relaxed">
              Rotating your master passphrase immediately invalidates all other active sessions and issues a new cryptographic signing key.
            </p>

            <div className="space-y-3 max-w-md">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5">
                <KeyRound className="h-4 w-4 text-white/40 shrink-0" />
                <input
                  type={showCurPass ? "text" : "password"}
                  value={curPass}
                  onChange={(e) => setCurPass(e.target.value)}
                  placeholder="Current master passphrase"
                  className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/30"
                />
                <button onClick={() => setShowCurPass((v) => !v)} className="text-white/40">
                  {showCurPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5">
                <KeyRound className="h-4 w-4 text-white/40 shrink-0" />
                <input
                  type={showNewPass ? "text" : "password"}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="New strong master passphrase (≥60 bits entropy)"
                  className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/30"
                />
                <button onClick={() => setShowNewPass((v) => !v)} className="text-white/40">
                  {showNewPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              <button
                id="change-passphrase-btn"
                onClick={() => changePassMut.mutate()}
                disabled={changePassMut.isPending || !curPass || !newPass}
                className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-xs font-bold text-black transition disabled:opacity-40"
              >
                {changePassMut.isPending ? "Cryptographically Updating…" : "Update Passphrase"}
              </button>

              {passError && (
                <p className="flex items-center gap-1.5 text-xs text-red-400 mt-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {passError}
                </p>
              )}
              {passSuccess && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-400 mt-2">
                  <Check className="h-3.5 w-3.5" />
                  {passSuccess}
                </p>
              )}
            </div>
          </FrostedPanel>

          {/* Recovery Codes Vault */}
          <FrostedPanel className="p-6 rounded-3xl border border-white/10 bg-[#0c1017]/80">
            <div className="flex items-center gap-3 mb-1">
              <Shield className="h-5 w-5 text-amber-400" />
              <h2 className="font-serif text-xl font-bold text-white">
                Offline Recovery Codes Vault
              </h2>
            </div>
            <p className="text-xs text-white/50 mb-5 leading-relaxed">
              If your passphrase is ever forgotten, these one-time cryptographic recovery codes are your only salvation.
            </p>

            {regenCodes ? (
              <RecoveryCodesReveal
                codes={regenCodes}
                onDone={() => setRegenCodes(null)}
              />
            ) : (
              <button
                id="regen-codes-btn"
                onClick={() => {
                  setRegenModal(true);
                  setRegenError("");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition"
              >
                <RefreshCw className="h-4 w-4" />
                Issue Fresh Recovery Code Vault
              </button>
            )}
          </FrostedPanel>
        </motion.div>
      )}

      {/* ─── TAB 4: SESSIONS & AUDIT TRAIL ───────────────────────────────────── */}
      {activeTab === "sessions" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Active Sessions Invalidation */}
          <FrostedPanel className="p-6 rounded-3xl border border-white/10 bg-[#0c1017]/80">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <LogOut className="h-5 w-5 text-amber-400" />
                <h2 className="font-serif text-xl font-bold text-white">
                  Active Multi-Device Sessions
                </h2>
              </div>
            </div>
            <p className="text-xs text-white/50 mb-4 leading-relaxed">
              Immediately revoke all authorization tokens across other devices, browsers, or stolen cookies. This current device remains authenticated with a fresh cryptographic token.
            </p>

            <button
              id="logout-all-btn"
              onClick={() => {
                setLogoutAllModal(true);
                setLogoutAllError("");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition"
            >
              <LogOut className="h-4 w-4" />
              Sign Out All Remote Sessions
            </button>
          </FrostedPanel>

          {/* Security Audit Timeline */}
          <FrostedPanel className="p-6 rounded-3xl border border-white/10 bg-[#0c1017]/80">
            <div className="flex items-center gap-3 mb-1">
              <Activity className="h-5 w-5 text-amber-400" />
              <h2 className="font-serif text-xl font-bold text-white">
                Anonymized Security Audit Trail
              </h2>
            </div>
            <p className="text-xs text-white/50 mb-6 leading-relaxed">
              Zero-knowledge log of all security events on this node. Replaces invasive email alerts while preserving complete user privacy.
            </p>

            {securityEvents.length === 0 ? (
              <p className="text-xs text-white/40">No audit events logged yet.</p>
            ) : (
              <div className="relative border-l border-white/10 pl-6 ml-3 space-y-6">
                {securityEvents.slice(0, 15).map((ev: any) => (
                  <div key={ev.id} className="relative">
                    {/* Glowing pulse indicator dot */}
                    <div className="absolute -left-[30px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0c1017] border-2 border-white/20">
                      <div className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 bg-white/5 p-1.5 rounded-xl border border-white/10">
                        {EVENT_ICONS[ev.type] ?? <Info className="h-4 w-4 text-white/50" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white">
                          {EVENT_LABELS[ev.type] ?? ev.type}
                        </p>
                        <p className="text-[10px] text-white/40 mt-0.5">
                          {formatTs(ev.createdAt)}
                          {ev.deviceFingerprintHash && (
                            <span
                              className="ml-2 font-mono opacity-50 select-all"
                              title="Anonymized device hash"
                            >
                              #{ev.deviceFingerprintHash.slice(0, 8)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FrostedPanel>
        </motion.div>
      )}

      {/* ─── TAB 5: DANGER ZONE ──────────────────────────────────────────────── */}
      {activeTab === "danger" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <FrostedPanel className="border-red-500/30 bg-red-500/[0.03] p-6 rounded-3xl">
            <div className="flex items-center gap-3 mb-2">
              <ShieldAlert className="h-5 w-5 text-red-400" />
              <h2 className="font-serif text-xl font-bold text-red-400">
                Sovereign Node Destruction
              </h2>
            </div>
            <p className="text-xs text-white/60 mb-5 leading-relaxed">
              Permanently and irreversibly obliterate your account. All cryptographic keys, broadcasts, media streams, comments, and private whispers will be hard-purged immediately.
            </p>

            <button
              id="delete-account-btn"
              onClick={() => {
                setDeleteModal(true);
                setDeleteError("");
              }}
              disabled={deleteAccMut.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-500/40 px-5 py-3 text-xs font-bold text-red-200 transition hover:bg-red-500/30 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              {deleteAccMut.isPending ? "Purging Sovereign Node…" : "Permanently Destroy Account & Data"}
            </button>
          </FrostedPanel>

          {/* Detailed Never Collected Charter */}
          <FrostedPanel className="p-6 rounded-3xl border border-white/10 bg-[#0c1017]/80">
            <h3 className="font-serif text-lg font-bold text-white mb-2">
              Full Sovereign Charter
            </h3>
            <p className="text-xs text-white/50 mb-4 leading-relaxed">
              Every packet on Social Space is routed without surveillance. Here is our architectural guarantee:
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
              {[
                "No legal names or government credentials",
                "No phone numbers or email addresses",
                "No facial geometry or biometric templates stored on server",
                "No IP addresses or location geolocation tracking",
                "No advertising identifiers or telemetry analytics",
                "No secret social graph cross-matching",
                "No reading dwell-time or gaze tracking",
                "No third-party pixel beacons or ad cookies",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-white/80"
                >
                  <div className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </FrostedPanel>
        </motion.div>
      )}

      {/* ─── Modals ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {/* Remove Passkey Modal */}
        {removePasskeyModal && (
          <PassphraseModal
            title={`Revoke "${removePasskeyModal.nickname}"?`}
            description="Enter your sovereign passphrase to confirm passkey revocation."
            isLoading={removePasskeyMut.isPending}
            error={removePasskeyError}
            onClose={() => {
              setRemovePasskeyModal(null);
              setRemovePasskeyError("");
            }}
            onConfirm={(passphrase) =>
              removePasskeyMut.mutate({ id: removePasskeyModal.id, passphrase })
            }
          />
        )}

        {/* Disable TOTP Modal */}
        {disableTotpModal && (
          <PassphraseModal
            title="Deactivate Two-Factor Authentication?"
            description="Enter your master passphrase to confirm disabling TOTP. Your node will only be protected by your passphrase."
            isLoading={disableTotpMut.isPending}
            error={disableTotpError}
            onClose={() => {
              setDisableTotpModal(false);
              setDisableTotpError("");
            }}
            onConfirm={(passphrase) => disableTotpMut.mutate(passphrase)}
          />
        )}

        {/* Regenerate Recovery Codes Modal */}
        {regenModal && (
          <PassphraseModal
            title="Generate Fresh Recovery Keys?"
            description="All previous recovery codes will be immediately destroyed. Enter your passphrase to continue."
            isLoading={regenCodesMut.isPending}
            error={regenError}
            onClose={() => setRegenModal(false)}
            onConfirm={(passphrase) => regenCodesMut.mutate(passphrase)}
          />
        )}

        {/* Logout All Modal */}
        {logoutAllModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0d121c] p-6 shadow-2xl"
            >
              <h3 className="font-serif text-xl font-bold text-white mb-2">
                Sign Out All Remote Sessions?
              </h3>
              <p className="text-xs text-white/60 mb-4 leading-relaxed">
                All tokens on other devices will be immediately invalidated. You will remain signed in here with a newly rotated token.
              </p>
              {logoutAllError && (
                <p className="text-xs text-red-400 mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {logoutAllError}
                </p>
              )}
              <div className="flex gap-2.5">
                <button
                  onClick={() => setLogoutAllModal(false)}
                  className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs font-semibold text-white/70 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  id="confirm-logout-all-btn"
                  onClick={() => logoutAllMut.mutate()}
                  disabled={logoutAllMut.isPending}
                  className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 py-2.5 text-xs font-bold text-black transition disabled:opacity-40"
                >
                  {logoutAllMut.isPending ? "Invalidating…" : "Sign Out All"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Permanent Account Destruction Modal */}
        {deleteModal && (
          <PassphraseModal
            title="Irreversibly Purge Account?"
            description="This action cannot be undone. Enter your master passphrase to confirm permanent destruction of all transmissions and keys."
            isLoading={deleteAccMut.isPending}
            error={deleteError}
            onClose={() => setDeleteModal(false)}
            onConfirm={(passphrase) => deleteAccMut.mutate(passphrase)}
          />
        )}

        {/* Premium Membership Modal */}
        {showPremiumModal &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{
                background: "rgba(0,0,0,0.7)",
                backdropFilter: "blur(14px)",
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) closePremiumModal();
              }}
              role="dialog"
              aria-modal="true"
            >
              <div className="pointer-events-none absolute h-96 w-96 rounded-full bg-amber-500/10 blur-[80px]" />

              <motion.div
                ref={premiumModalRef}
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 12 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-amber-500/30 bg-[#090d14] p-8 shadow-2xl"
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

                <button
                  onClick={closePremiumModal}
                  className="absolute right-5 top-5 rounded-lg p-1.5 text-white/50 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
                  <Crown className="h-8 w-8 text-amber-400" />
                </div>

                <div className="text-center mb-6">
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    Sovereign Pro
                  </span>
                  <h3 className="font-serif text-2xl text-white font-bold mt-2">
                    Premium Sovereign Tier
                  </h3>
                  <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
                    Zero-retention media storage extension, unlimited 4K video broadcasting, and priority cryptographic relays.
                  </p>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-2.5">
                  {[
                    { icon: Zap, text: "Extended Video TTL" },
                    { icon: Sparkles, text: "Unlimited Uploads" },
                    { icon: Shield, text: "Zero Telemetry" },
                    { icon: Crown, text: "Gold Node Crest" },
                  ].map(({ icon: Icon, text }) => (
                    <div
                      key={text}
                      className="flex items-center gap-2 rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 py-2.5"
                    >
                      <Icon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span className="text-[11px] font-medium text-white/80">
                        {text}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mb-6 text-center">
                  <span className="font-serif text-3xl font-bold text-amber-400">
                    ₹149
                  </span>
                  <span className="text-xs text-white/50 ml-1">/ month</span>
                </div>

                <div className="space-y-2.5">
                  <button
                    ref={joinBtnRef}
                    onClick={handleJoinWaitlist}
                    disabled={waitlistJoined}
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 py-3 text-xs font-bold text-black transition shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-60"
                  >
                    {waitlistJoined ? "Node Enrolled on Waitlist" : "Join Sovereign Waitlist"}
                  </button>
                  <button
                    onClick={closePremiumModal}
                    className="w-full rounded-xl border border-white/10 py-2.5 text-xs text-white/60 hover:text-white transition"
                  >
                    Maybe Later
                  </button>
                </div>
              </motion.div>
            </div>,
            document.body,
          )}
      </AnimatePresence>

      {/* Success Notification Toast */}
      <AnimatePresence>
        {premiumToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 rounded-2xl border border-amber-500/40 bg-black/95 px-5 py-3 text-xs font-bold text-amber-300 shadow-2xl backdrop-blur-xl"
          >
            <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
            {premiumToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
