import type { Product } from "../format";

export type NormalizedPerson = {
  email: string;
  name?: string | null;
  externalId?: string | null;
  team?: string | null;
  title?: string | null;
  seat?: string | null;
  lastActiveDate?: string | null;
};

/** Activity counts for one person/day/product. */
export type NormalizedActivity = {
  email: string;
  date: string;
  product: Product;
  messages: number;
  conversations: number;
  sessions: number;
  commits: number;
  pullRequests: number;
  linesAdded: number;
  linesRemoved: number;
};

export type NormalizedCost = { email: string; date: string; product: Product; costCents: number };

export type NormalizedCheckin = { email: string; occurredAt: Date; text: string };

export type ProviderBatch = {
  people: NormalizedPerson[];
  activity: NormalizedActivity[];
  costs: NormalizedCost[];
  checkins: NormalizedCheckin[];
  /** Latest day with complete activity data, or null if nothing was imported. */
  syncedThrough: string | null;
  warnings: string[];
};
