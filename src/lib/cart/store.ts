import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CheckoutItem } from '@/types/checkout';

export interface CartItem extends CheckoutItem {
  id: string;
  // Metadados de apresentação existem apenas na sessão atual e não voltam do
  // armazenamento persistido como se fossem catálogo ou preço confiável.
  type?: 'service' | 'product';
  name?: string;
  imageUrl?: string | null;
  basePrice?: number;
  estimatedTotal?: number;
  // IDs de arquivo pertencem a uma sessão de upload e nunca devem sobreviver
  // a uma nova sessão do navegador.
  requiresFileReupload?: boolean;
}

type PersistedCartItem = Pick<
  CartItem,
  'id' | 'serviceId' | 'productId' | 'attributeIds' | 'quantity' | 'isFrontAndBack' | 'requiresFileReupload'
> & { fieldValues: CheckoutItem['fieldValues'] };

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      
      addItem: (item) => set((state) => {
        const id = crypto.randomUUID();
        return { items: [...state.items, { ...item, id }] };
      }),
      
      removeItem: (id) => set((state) => ({
        items: state.items.filter((i) => i.id !== id)
      })),
      
      updateQuantity: (id, quantity) => set((state) => ({
        items: state.items.map((i) => 
          i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i
        )
      })),
      
      clearCart: () => set({ items: [] })
    }),
    {
      name: 'jk-cart-storage',
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as { items?: CartItem[] };
        return {
          ...state,
          items: (state.items || []).map((item) => {
            const hasPersistedFile = Array.isArray(item.fileIds) && item.fileIds.length > 0;
            return {
              ...item,
              fileIds: [],
              bindingFileIds: [],
              requiresFileReupload: Boolean(item.requiresFileReupload || hasPersistedFile),
            };
          }),
        };
      },
      partialize: (state) => ({
        // O carrinho persistido é somente uma intenção. Preço, nome, imagem,
        // páginas e qualquer cotação são obtidos novamente do servidor.
        items: state.items.map((item): PersistedCartItem => ({
          id: item.id,
          serviceId: item.serviceId,
          productId: item.productId,
          attributeIds: item.attributeIds,
          fieldValues: item.fieldValues.map(({ fieldKey, value }) => ({ fieldKey, value })),
          quantity: item.quantity,
          isFrontAndBack: item.isFrontAndBack,
          requiresFileReupload: Boolean(item.requiresFileReupload || item.fileIds.length > 0),
        })),
      }),
    }
  )
);
