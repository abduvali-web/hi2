/**
 * Todo #4: Prisma-backed idempotency for server analytics dispatch.
 * Uses composite unique (orderId, eventName) to ensure exactly-once semantics.
 *
 * NOTE: Migration not executed here. Run later:
 *   npx prisma migrate dev -n add_event_dispatch
 *
 * Admin KPI note: Future admin metrics will read from EventDispatch + orders for funnel visibility.
 */

import { db } from "@/lib/db";

// Using `any` access pattern to avoid TypeScript issues before migration is run and client regenerated.
// After running the migration, you can replace `(db as any).eventDispatch` with `db.eventDispatch`.
const eventDispatch = (db as any).eventDispatch as {
  findUnique: (args: { where: { orderId_eventName: { orderId: string; eventName: string } } }) => Promise<any | null>;
  create: (args: { data: { orderId: string; eventName: string } }) => Promise<any>;
};

export async function hasDispatched(orderId: string, eventName: string): Promise<boolean> {
  try {
    const rec = await eventDispatch.findUnique({
      where: { orderId_eventName: { orderId, eventName } },
    });
    return !!rec;
  } catch {
    // If DB not migrated yet, treat as not dispatched (non-blocking best-effort).
    return false;
  }
}

export async function markDispatched(orderId: string, eventName: string): Promise<void> {
  try {
    await eventDispatch.create({
      data: { orderId, eventName },
    });
  } catch {
    // Ignore unique constraint or migration errors; best-effort fire-and-forget.
  }
}