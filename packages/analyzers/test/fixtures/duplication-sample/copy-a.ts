// Intentionally duplicated block for cohesion test. Do not refactor.
export function processOrder(order: { items: Array<{ price: number; qty: number }> }): number {
  let subtotal = 0;
  for (const item of order.items) {
    if (item.qty < 0) throw new Error('negative quantity');
    if (item.price < 0) throw new Error('negative price');
    subtotal += item.price * item.qty;
  }
  const tax = subtotal * 0.1;
  const shipping = subtotal > 100 ? 0 : 10;
  const discount = subtotal > 500 ? subtotal * 0.05 : 0;
  return subtotal + tax + shipping - discount;
}

export function summarize(label: string, value: number): string {
  const formatted = value.toFixed(2);
  const sigil = value >= 0 ? '+' : '-';
  return `${label}: ${sigil}${formatted}`;
}
