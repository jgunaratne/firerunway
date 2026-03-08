/**
 * Utility to mask sensitive account numbers.
 * Only the last 4 digits are preserved; the rest is replaced with "****".
 */
export function maskAccountNumber(num: string | null | undefined): string {
  if (!num) return '';
  const trimmed = num.trim();
  if (!trimmed) return '';

  // Already masked — return as-is
  if (trimmed.startsWith('****') || trimmed.startsWith('*')) return trimmed;

  // Mask all but last 4 characters
  if (trimmed.length > 4) {
    return `****${trimmed.slice(-4)}`;
  }

  // Very short number — mask entirely
  return '****';
}
