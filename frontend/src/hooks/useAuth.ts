import { useState, useEffect } from "react";
import { getCurrentUser, isAuthenticated, type ApiUser } from "@/lib/api";

export interface AuthState {
  isMounted: boolean;
  isAuthenticated: boolean;
  user: { id: string; handle: string; avatarUrl?: string | null } | null;
}

export function useAuth(): AuthState {
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<{ id: string; handle: string; avatarUrl?: string | null } | null>(null);

  useEffect(() => {
    setMounted(true);
    setAuthed(isAuthenticated());
    setUser(getCurrentUser());

    const handleAuthChange = () => {
      setAuthed(isAuthenticated());
      setUser(getCurrentUser());
    };

    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("veil-auth-change", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("veil-auth-change", handleAuthChange);
    };
  }, []);

  return {
    isMounted: mounted,
    isAuthenticated: mounted ? authed : false,
    user: mounted ? user : null,
  };
}
