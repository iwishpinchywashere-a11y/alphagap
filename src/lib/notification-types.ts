// Shared notification types — no server-side imports so safe to use in client components

export type NotificationType = "score" | "signal" | "whale" | "report" | "social" | "benchmark";

export interface AppNotification {
  id: string;
  type: NotificationType;
  netuid: number;
  subnetName: string;
  message: string;
  url: string;
  timestamp: string;
  read: boolean;
}

export interface NotificationSnapshot {
  scores: Record<number, number>;           // netuid → composite_score
  benchmarkScores: Record<number, number>;  // netuid → benchmark_score
  signalIds: number[];                      // seen signal IDs
  tweetIds: string[];                       // seen tweet_ids
  reportKeys: string[];                     // `${date}-${netuid}` seen
  checkedAt: string;                        // ISO timestamp of last check
}

export interface NotificationStore {
  notifications: AppNotification[];
  snapshot: NotificationSnapshot | null;
}
