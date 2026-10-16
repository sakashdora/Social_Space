import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { communityRequest } from "@/lib/api";

export function ModerationQueue() {
  const client = useQueryClient();
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const queue = useQuery({
    queryKey: ["moderation"],
    queryFn: () => communityRequest("moderation"),
  });
  async function update(kind: string, id: string, status: string) {
    setBusy(true);
    setError("");
    try {
      await communityRequest(
        `moderation/${kind}/${id}`,
        { status, currentPassphrase: passphrase },
        "PATCH",
      );
      setPassphrase("");
      await client.invalidateQueries({ queryKey: ["moderation"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mb-6 space-y-3 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">Moderator review queue</h2>
      <p className="text-xs text-muted-foreground">
        Record review outcomes here. Changing a review status does not delete
        content or suspend accounts.
      </p>
      <label className="block text-sm">
        Confirm your passphrase to update a review
        <input
          type="password"
          autoComplete="current-password"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          className="mt-2 w-full rounded-lg border border-border bg-background p-2"
        />
      </label>
      {(error || queue.error) && (
        <p role="alert" className="text-sm text-red-500">
          {error || queue.error?.message}
        </p>
      )}
      {queue.isLoading && <p>Loading reviews…</p>}
      {(["reports", "appeals"] as const).map((kind) => (
        <div key={kind} className="space-y-2">
          <h3 className="font-medium capitalize">{kind}</h3>
          {queue.data?.[kind]?.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending {kind}.</p>
          )}
          {queue.data?.[kind]?.map(
            (item: {
              id: string;
              target?: string;
              reference?: string;
              reason: string;
              status: string;
            }) => (
              <article
                key={item.id}
                className="space-y-2 rounded-xl border border-border p-3 text-sm"
              >
                <p className="break-words">{item.target || item.reference}</p>
                <p className="whitespace-pre-wrap break-words">{item.reason}</p>
                <p>Status: {item.status}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["reviewing", "In review"],
                    ["action", "Action recorded"],
                    ["no-violation", "No violation"],
                  ].map(([status, label]) => (
                    <button
                      key={status}
                      disabled={busy || !passphrase}
                      onClick={() => void update(kind, item.id, status)}
                      className="rounded-lg border border-border px-3 py-1 disabled:opacity-40"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </article>
            ),
          )}
        </div>
      ))}
    </section>
  );
}
