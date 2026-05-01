export interface WhaleSignalEntry {
  id: string;                  // UUID
  netuid: number;
  subnetName: string;
  signal: "accumulating" | "distributing";
  entryPrice: number;          // alpha_price at signal start
  entryAt: string;             // ISO timestamp
  priceAt7d?: number;          // alpha_price 7 days after entry
  priceAt14d?: number;         // alpha_price 14 days after entry
  priceAt30d?: number;         // alpha_price 30 days after entry
  exitAt?: string;             // when signal reversed or stopped
  exitPrice?: number;          // price when signal ended
  status: "active" | "closed";
}

export interface WhaleTrackerState {
  entries: WhaleSignalEntry[];
  // Tracks what signal is currently active per subnet (for detecting new starts)
  currentSignals: Record<number, "accumulating" | "distributing" | null>;
  lastUpdatedAt: string;
}
