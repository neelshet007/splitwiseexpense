/**
 * Financial minor unit helper functions.
 * Stored internally as integer minor units (paise/cents).
 * E.g., 120000 = ₹1,200.00
 */

export function minorToMajor(minorAmount: number): number {
  return minorAmount / 100;
}

export function majorToMinor(majorAmount: number): number {
  return Math.round(majorAmount * 100);
}

export function formatCurrency(minorAmount: number, currency = 'INR'): string {
  const major = minorToMajor(minorAmount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: minorAmount % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(major);
}
