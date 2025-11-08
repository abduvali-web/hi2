/**
 * Analytics event naming constants (no usage yet).
 *
 * Mappings for future reference:
 * - order_started   -> GA4: begin_checkout,      Meta: InitiateCheckout
 * - order_submitted -> GA4: add_payment_info,    Meta: AddPaymentInfo
 * - order_paid      -> GA4: purchase,            Meta: Purchase
 * - page_view       -> GA4: page_view,           Meta: PageView
 */

export const page_view = "page_view" as const;
export const order_started = "order_started" as const;
export const order_submitted = "order_submitted" as const;
export const order_paid = "order_paid" as const;

// Optional helper type if needed later (not used now).
export type AnalyticsEventName =
  | typeof page_view
  | typeof order_started
  | typeof order_submitted
  | typeof order_paid;