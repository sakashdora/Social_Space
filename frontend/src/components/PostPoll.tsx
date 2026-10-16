import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { voteOnPoll } from "@/lib/api";

type PollPost = {
  id: string;
  pollOptions?: { text: string; votes: number }[];
  votedOption?: number | null;
};
export function PostPoll({ post }: { post: PollPost }) {
  const client = useQueryClient();
  const [poll, setPoll] = useState(post);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setPoll(post), [post]);
  if (!poll.pollOptions?.length) return null;
  const total = poll.pollOptions.reduce((sum, option) => sum + option.votes, 0);
  async function vote(index: number) {
    setBusy(true);
    setError("");
    try {
      const result = await voteOnPoll(post.id, index);
      setPoll((previous) => ({ ...previous, ...result }));
      void client.invalidateQueries({ queryKey: ["posts"] });
      void client.invalidateQueries({ queryKey: ["my-posts"] });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Vote could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="my-3 space-y-2" aria-label="Poll">
      {poll.pollOptions.map((option, index) => (
        <button
          key={index}
          onClick={() => void vote(index)}
          disabled={busy}
          aria-pressed={poll.votedOption === index}
          className="flex w-full justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left text-sm aria-pressed:border-amber-500 disabled:opacity-50"
        >
          <span>
            {option.text}
            {poll.votedOption === index ? " ✓" : ""}
          </span>
          <span>{total ? Math.round((option.votes / total) * 100) : 0}%</span>
        </button>
      ))}
      <p className="text-xs text-muted-foreground">
        {total} votes · One vote per account
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
