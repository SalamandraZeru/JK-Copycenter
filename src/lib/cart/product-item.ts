import type { NewCartItem } from './store';

// Item de carrinho para um produto de papelaria (sem configuração nem arquivo).
// Compartilhado pelos cartões de produto e pela página de detalhe.
export function productCartItem(
  product: { id: string; name: string; image_url: string | null; price: number },
  quantity = 1,
): NewCartItem {
  return {
    productId: product.id,
    name: product.name,
    imageUrl: product.image_url,
    type: 'product',
    basePrice: product.price,
    estimatedTotal: product.price,
    attributeIds: [],
    fieldValues: [],
    pageCount: 1,
    isFrontAndBack: false,
    quantity,
    fileIds: [],
  };
}
