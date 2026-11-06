import { useState } from "react";
import { AlertTriangle, KeyRound } from "lucide-react";

interface TotpInputProps {
  onSubmit: (code: string) => void;
  isLoading: boolean;
  error: string;
}

/** Six-digit authenticator code entry, shared by sign-in and onboarding. */
export function TotpInput({ onSubmit, isLoading, error }: TotpInputProps) {
  const [code, setCode] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6 && !isLoading) onSubmit(code);
      }}
    >
      <label className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 focus-within:border-amber-400/60 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all">
        <KeyRound
          className="h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="sr-only">Six-digit authenticator code</span>
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="000000"
          className="flex-1 bg-transparent text-lg tracking-widest text-foreground outline-none placeholder:text-muted-foreground font-mono"
        />
      </label>
      {error && (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-xs text-red-500"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isLoading || code.length !== 6}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 px-5 py-3 text-sm font-semibold text-black transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(245,158,11,0.35)] cursor-pointer"
      >
        {isLoading ? "Verifying…" : "Verify code"}
      </button>
    </form>
  );
}
