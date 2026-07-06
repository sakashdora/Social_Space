export type Post = {
  id: string;
  author: string;
  color: string;
  handle: string;
  topic: string;
  time: string;
  body: string;
  media?: "portrait" | "landscape" | null;
  synthetic?: boolean;
  reactions: number;
  replies: number;
};

export const feedPosts: Post[] = [
  {
    id: "p1",
    author: "muted-heron-42",
    color: "#0D7377",
    handle: "@muted-heron-42",
    topic: "Journalism",
    time: "3m",
    body:
      "First draft of the piece is out to my editor. Wrote it entirely on a device that has never touched my legal name. That still feels miraculous.",
    reactions: 128,
    replies: 24,
  },
  {
    id: "p2",
    author: "quiet-linen",
    color: "#8B5CF6",
    handle: "@quiet-linen",
    topic: "Art",
    time: "17m",
    body:
      "Sharing a portrait study. Face is procedurally replaced on-device before publish — the meter said green on every row.",
    media: "portrait",
    synthetic: true,
    reactions: 412,
    replies: 63,
  },
  {
    id: "p3",
    author: "slow-orbit",
    color: "#E5C07B",
    handle: "@slow-orbit",
    topic: "Survivors",
    time: "1h",
    body:
      "Six months of writing here without anyone in my old life finding me. Whatever else Veil ships, don't add follower counts. This is the reason I stayed.",
    reactions: 986,
    replies: 141,
  },
  {
    id: "p4",
    author: "north-of-here",
    color: "#3EC5A6",
    handle: "@north-of-here",
    topic: "Activism",
    time: "3h",
    body:
      "PSA — the disappearing-message timer is per-thread now. Set it to 24h on your organizing threads and stop worrying about screenshots living forever.",
    reactions: 217,
    replies: 32,
  },
];

export const topics = [
  "All",
  "Journalism",
  "Art",
  "Survivors",
  "Activism",
  "Research",
  "Writing",
];

export type Thread = {
  id: string;
  handle: string;
  color: string;
  preview: string;
  time: string;
  verified: boolean;
  disappearing: string | null;
  unread?: number;
};

export const threads: Thread[] = [
  {
    id: "t1",
    handle: "quiet-linen",
    color: "#8B5CF6",
    preview: "sent you the encrypted folder — safety number verified.",
    time: "2m",
    verified: true,
    disappearing: "24h",
    unread: 2,
  },
  {
    id: "t2",
    handle: "north-of-here",
    color: "#3EC5A6",
    preview: "meeting at 7. bring the redacted pdfs only.",
    time: "1h",
    verified: true,
    disappearing: "7d",
  },
  {
    id: "t3",
    handle: "muted-heron-42",
    color: "#0D7377",
    preview: "thank you. i think this piece changes things.",
    time: "yesterday",
    verified: false,
    disappearing: null,
  },
];

export type ThreadMessage = {
  id: string;
  mine: boolean;
  body: string;
  time: string;
};

export const threadMessages: Record<string, ThreadMessage[]> = {
  t1: [
    { id: "m1", mine: false, body: "I finished the redactions. Everything Presidio flagged is masked.", time: "10:04" },
    { id: "m2", mine: true, body: "Great. I'll verify the safety number before you send.", time: "10:05" },
    { id: "m3", mine: false, body: "Already verified on my side — the shield went green.", time: "10:06" },
    { id: "m4", mine: false, body: "Sending now. Disappears in 24h — save what you need.", time: "10:07" },
  ],
  t2: [
    { id: "m1", mine: false, body: "meeting at 7. bring the redacted pdfs only.", time: "9:12" },
  ],
  t3: [
    { id: "m1", mine: true, body: "It's live.", time: "yest 8:41" },
    { id: "m2", mine: false, body: "thank you. i think this piece changes things.", time: "yest 8:43" },
  ],
};

export type Report = {
  id: string;
  target: string;
  reason: string;
  submitted: string;
  status: "received" | "reviewing" | "action" | "no-violation";
  outcome?: string;
  appealable: boolean;
};

export const reports: Report[] = [
  {
    id: "r1",
    target: "Post from @broken-signal",
    reason: "Targeted harassment",
    submitted: "2 hours ago",
    status: "reviewing",
    appealable: false,
  },
  {
    id: "r2",
    target: "DM from @grey-static",
    reason: "Unsolicited intimate imagery",
    submitted: "yesterday",
    status: "action",
    outcome: "Content removed. Trust Token flagged.",
    appealable: false,
  },
  {
    id: "r3",
    target: "Post from @half-moon",
    reason: "Impersonation",
    submitted: "3 days ago",
    status: "no-violation",
    outcome: "Reviewed by moderator — no violation of guidelines.",
    appealable: true,
  },
];

export const neverCollected = [
  "Your legal name",
  "Your email address",
  "Your phone number",
  "Your date of birth or ID document",
  "Your face, voice, or biometric templates",
  "Your precise location",
  "Your device identifier or advertising ID",
  "A graph of who you message",
  "Your reading, dwell-time, or scroll behavior",
];
