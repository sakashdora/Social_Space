import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  API_BASE,
  getHeaders,
  handleResponse,
  getCurrentUser,
} from "@/lib/api";
import { setChatRealtimeConnected } from "@/lib/chatRealtimeStatus";

export function useChatRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    setChatRealtimeConnected(connected);
    return () => setChatRealtimeConnected(false);
  }, [connected]);
  const userId = getCurrentUser()?.id;
  useEffect(() => {
    setConnected(false);
    if (!enabled || !userId) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    let disconnect: (() => void) | undefined;
    const session = () =>
      fetch(`${API_BASE}/v1/chats/realtime`, { headers: getHeaders() }).then(
        handleResponse,
      );
    async function connect() {
      try {
        const configuration = await session();
        if (!active || !configuration.enabled) return;
        const { createClient } = await import("@supabase/supabase-js");
        if (!active) return;
        const client = createClient(configuration.url, configuration.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        disconnect = () => {
          void client.removeAllChannels();
          client.realtime.disconnect();
        };
        await client.realtime.setAuth(configuration.token);
        if (!active) {
          disconnect();
          return;
        }
        client
          .channel(configuration.topic, { config: { private: true } })
          .on("broadcast", { event: "chat" }, ({ payload }) => {
            void queryClient.invalidateQueries({ queryKey: ["chats"] });
            if (typeof payload?.threadId === "string")
              void queryClient.invalidateQueries({
                queryKey: ["chatMessages", payload.threadId],
              });
          })
          .subscribe((status) => {
            if (active) setConnected(status === "SUBSCRIBED");
          });
        timer = setInterval(() => {
          void session()
            .then(async (fresh) => {
              if (!active) return;
              if (!fresh.enabled) {
                setConnected(false);
                disconnect?.();
                return;
              }
              await client.realtime.setAuth(fresh.token);
            })
            .catch(() => {
              if (active) {
                setConnected(false);
                disconnect?.();
              }
            });
        }, 60000);
      } catch {
        if (active) setConnected(false);
      }
    }
    void connect();
    return () => {
      active = false;
      clearInterval(timer);
      disconnect?.();
    };
  }, [enabled, userId, queryClient]);
  return connected;
}
