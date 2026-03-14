/** Default per-child flat rates (used on landing page and as fallback) */
export const DEFAULT_RATES = {
  MONTHLY: { amountCents: 40000, label: "Monthly", periodLabel: "per month" },   // $400
  QUARTERLY: { amountCents: 114000, label: "Quarterly", periodLabel: "per quarter", savings: "5%" },   // $1,140 ($380/mo equiv)
  ANNUAL: { amountCents: 432000, label: "Annually", periodLabel: "per year", savings: "10%" },   // $4,320 ($360/mo equiv)
};

export function formatPrice(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export const BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "ANNUAL"];
