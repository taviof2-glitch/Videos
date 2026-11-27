// Atajos para anticipos y abonos.
export const toInput = (c: number) => (c > 0 ? (c / 100).toFixed(2) : '')
/** La mitad del total, sin pasarse de lo que falta. */
export const halfOf = (totalCents: number, maxCents = totalCents) => Math.min(Math.round(totalCents / 2), maxCents)
