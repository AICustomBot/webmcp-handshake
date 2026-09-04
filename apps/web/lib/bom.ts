import type { BillOfMaterials, BomLine, Product, RoomState } from '@handshake/contracts';

/**
 * Computes a deterministic Bill of Materials from room items and catalog products.
 * Parity with packages/policy/src/guidelines.ts:buildBom.
 */
export function computeClientBom(state: RoomState, catalog: readonly Product[]): BillOfMaterials {
  const products = new Map(catalog.map((p) => [p.id, p]));
  const order: string[] = [];
  const counts = new Map<string, number>();
  const unpricedItemIds: string[] = [];

  for (const item of state.items) {
    const product = products.get(item.productId);
    if (!product) {
      unpricedItemIds.push(item.id);
      continue;
    }
    const seen = counts.get(item.productId);
    if (seen === undefined) {
      order.push(item.productId);
      counts.set(item.productId, 1);
    } else {
      counts.set(item.productId, seen + 1);
    }
  }

  const lines: BomLine[] = [];
  let subtotalCents = 0;
  let itemCount = 0;

  for (const productId of order) {
    const product = products.get(productId);
    const quantity = counts.get(productId);
    if (!product || quantity === undefined) continue;
    const totalCents = product.priceCents * quantity;
    lines.push({
      productId,
      name: product.name,
      category: product.category,
      sku: product.sku || product.id,
      quantity,
      unitPriceCents: product.priceCents,
      totalCents,
    });
    subtotalCents += totalCents;
    itemCount += quantity;
  }

  return {
    lines,
    subtotalCents,
    itemCount,
    unpricedItemIds,
  };
}
