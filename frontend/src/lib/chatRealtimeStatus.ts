import { useSyncExternalStore } from "react";
let connected = false;
const listeners = new Set<() => void>();
export function setChatRealtimeConnected(value: boolean) {
  connected = value;
  listeners.forEach((listener) => listener());
}
export function useChatRealtimeStatus() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => connected,
    () => false,
  );
}
