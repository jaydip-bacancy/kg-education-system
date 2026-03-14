export function determineBillingTier(centerCount, staffCount) {
  if (centerCount <= 1 && staffCount <= 10) return "STARTER"
  if (centerCount <= 3 || staffCount <= 50) return "GROWTH"
  return "SCALE"
}