/**
 * Page numbers to show: always first, last, current ±1, with "…" for gaps.
 * e.g. current 5 of 10 -> [1, '…', 4, 5, 6, '…', 10]
 */
export function pageItems(current, last) {
  const pages = new Set([1, last, current - 1, current, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b)

  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['…', p] : [p]))
}
