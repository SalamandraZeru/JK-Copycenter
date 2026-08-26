import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CheckoutItem } from '@/types/checkout';

const CART_FILE_SESSION_STORAGE_KEY = 'jk-cart-file-intents-v1';

export type CartRevalidationStatus =
  | 'pending'
  | 'ready'
  | 'requires_file_reupload'
  | 'configuration_needs_review'
  | 'unavailable'
  | 'quote_unavailable';

/**
 * A visual snapshot is strictly informational. Checkout never sends any
 * monetary field from it and always recalculates against the current catalog.
 */
export interface CartDisplaySnapshot {
  title: string;
  imageUrl: string | null;
  summary: string[];
  fileNames: string[];
  estimatedTotalCents: number | null;
  estimatedUnitCents: number | null;
  calculatedAt: string | null;
  pricingVersion: number | null;
  isEstimate: boolean;
  configurationFingerprint: string;
}

export interface CartItem extends CheckoutItem {
  id: string;
  type?: 'service' | 'product';
  // Legacy presentation fields stay optional only for migration from the
  // previous localStorage format. New UI reads displaySnapshot exclusively.
  name?: string;
  imageUrl?: string | null;
  basePrice?: number;
  estimatedTotal?: number;
  displaySnapshot: CartDisplaySnapshot;
  revalidationStatus: CartRevalidationStatus;
  requiresFileReupload: boolean;
  priceChanged: boolean;
}

export type NewCartItem = Omit<
  CartItem,
  'id' | 'displaySnapshot' | 'revalidationStatus' | 'requiresFileReupload' | 'priceChanged'
> & {
  displaySnapshot?: Partial<CartDisplaySnapshot>;
};

type PersistedCartItem = Pick<
  CartItem,
  | 'id'
  | 'serviceId'
  | 'productId'
  | 'attributeIds'
  | 'fieldValues'
  | 'pageCount'
  | 'quantity'
  | 'isFrontAndBack'
  | 'displaySnapshot'
  | 'revalidationStatus'
  | 'requiresFileReupload'
  | 'priceChanged'
  | 'type'
>;

export interface CartRevalidationPatch {
  displaySnapshot?: CartDisplaySnapshot;
  revalidationStatus: CartRevalidationStatus;
  requiresFileReupload?: boolean;
  priceChanged?: boolean;
}

interface SessionFileIntent {
  fileIds: string[];
  bindingFileIds: string[];
}

interface CartState {
  items: CartItem[];
  addItem: (item: NewCartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  restoreSessionFiles: () => void;
  applyRevalidation: (id: string, patch: CartRevalidationPatch) => void;
  clearCart: () => void;
}

function safeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function safeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, 300) : fallback;
}

function displayValue(value: string | number | boolean): string {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value).slice(0, 160);
}

export function cartConfigurationFingerprint(item: Pick<
  CartItem,
  'serviceId' | 'productId' | 'attributeIds' | 'fieldValues' | 'pageCount' | 'quantity' | 'isFrontAndBack' | 'bindingFileIds'
>): string {
  return JSON.stringify({
    serviceId: item.serviceId || null,
    productId: item.productId || null,
    attributeIds: [...item.attributeIds].sort(),
    fieldValues: [...item.fieldValues]
      .map(({ fieldKey, value }) => ({ fieldKey, value }))
      .sort((left, right) => left.fieldKey.localeCompare(right.fieldKey)),
    pageCount: item.pageCount,
    quantity: item.quantity,
    isFrontAndBack: item.isFrontAndBack,
    bindingFileIds: [...(item.bindingFileIds ?? [])].sort(),
  });
}

export function createCartDisplaySnapshot(
  item: Pick<CartItem, 'serviceId' | 'productId' | 'attributeIds' | 'fieldValues' | 'pageCount' | 'quantity' | 'isFrontAndBack' | 'bindingFileIds' | 'name' | 'imageUrl' | 'estimatedTotal'>,
  overrides: Partial<CartDisplaySnapshot> = {},
): CartDisplaySnapshot {
  const summary = overrides.summary
    ?? item.fieldValues
      .filter((field) => field.value !== false && field.value !== '')
      .map((field) => `${field.label || field.fieldKey}: ${field.selectedOption?.label || displayValue(field.value)}`)
      .slice(0, 12);
  const estimatedTotalCents = overrides.estimatedTotalCents
    ?? (typeof item.estimatedTotal === 'number' && Number.isFinite(item.estimatedTotal)
      ? Math.round(item.estimatedTotal * 100)
      : null);

  return {
    title: safeText(overrides.title, item.name || 'Item selecionado'),
    imageUrl: typeof overrides.imageUrl === 'string' || overrides.imageUrl === null
      ? overrides.imageUrl
      : item.imageUrl || null,
    summary,
    fileNames: Array.isArray(overrides.fileNames)
      ? overrides.fileNames.filter((name): name is string => typeof name === 'string').map((name) => name.slice(0, 200))
      : [],
    estimatedTotalCents: safeInteger(estimatedTotalCents),
    estimatedUnitCents: safeInteger(overrides.estimatedUnitCents),
    calculatedAt: typeof overrides.calculatedAt === 'string' ? overrides.calculatedAt : null,
    pricingVersion: safeInteger(overrides.pricingVersion),
    isEstimate: Boolean(overrides.isEstimate),
    configurationFingerprint: overrides.configurationFingerprint || cartConfigurationFingerprint({
      ...item,
      bindingFileIds: item.bindingFileIds ?? [],
    }),
  };
}

function sessionStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function readSessionFileIntents(): Record<string, SessionFileIntent> {
  if (!sessionStorageAvailable()) return {};
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(CART_FILE_SESSION_STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.entries(parsed).reduce<Record<string, SessionFileIntent>>((accumulator, [id, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return accumulator;
      const candidate = value as { fileIds?: unknown; bindingFileIds?: unknown };
      if (!Array.isArray(candidate.fileIds) || !Array.isArray(candidate.bindingFileIds)) return accumulator;
      accumulator[id] = {
        fileIds: candidate.fileIds.filter((fileId): fileId is string => typeof fileId === 'string'),
        bindingFileIds: candidate.bindingFileIds.filter((fileId): fileId is string => typeof fileId === 'string'),
      };
      return accumulator;
    }, {});
  } catch {
    return {};
  }
}

function writeSessionFileIntents(intents: Record<string, SessionFileIntent>): void {
  if (!sessionStorageAvailable()) return;
  try {
    window.sessionStorage.setItem(CART_FILE_SESSION_STORAGE_KEY, JSON.stringify(intents));
  } catch {
    // sessionStorage is a convenience cache only; server-side ownership checks
    // remain the authorization boundary if it is unavailable.
  }
}

function saveSessionFiles(id: string, fileIds: string[], bindingFileIds: string[]): void {
  const intents = readSessionFileIntents();
  if (fileIds.length === 0) {
    delete intents[id];
  } else {
    intents[id] = { fileIds: [...fileIds], bindingFileIds: [...bindingFileIds] };
  }
  writeSessionFileIntents(intents);
}

function removeSessionFiles(id?: string): void {
  if (!sessionStorageAvailable()) return;
  if (!id) {
    window.sessionStorage.removeItem(CART_FILE_SESSION_STORAGE_KEY);
    return;
  }
  const intents = readSessionFileIntents();
  delete intents[id];
  writeSessionFileIntents(intents);
}

function normalizePersistedItem(raw: Partial<CartItem>): CartItem {
  const legacyFileIds = Array.isArray(raw.fileIds) ? raw.fileIds.filter((value): value is string => typeof value === 'string') : [];
  const fieldValues = Array.isArray(raw.fieldValues)
    ? raw.fieldValues.filter((value): value is CheckoutItem['fieldValues'][number] => (
      Boolean(value)
      && typeof value.fieldKey === 'string'
      && ['string', 'number', 'boolean'].includes(typeof value.value)
    ))
    : [];
  const base = {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    ...(typeof raw.serviceId === 'string' ? { serviceId: raw.serviceId } : {}),
    ...(typeof raw.productId === 'string' ? { productId: raw.productId } : {}),
    attributeIds: Array.isArray(raw.attributeIds) ? raw.attributeIds.filter((value): value is string => typeof value === 'string') : [],
    fieldValues,
    pageCount: typeof raw.pageCount === 'number' && Number.isInteger(raw.pageCount) && raw.pageCount > 0 ? raw.pageCount : 1,
    isFrontAndBack: Boolean(raw.isFrontAndBack),
    quantity: typeof raw.quantity === 'number' && Number.isInteger(raw.quantity) && raw.quantity > 0 ? raw.quantity : 1,
    fileIds: [],
    bindingFileIds: [],
    ...(raw.type ? { type: raw.type } : {}),
    ...(typeof raw.name === 'string' ? { name: raw.name } : {}),
    ...(typeof raw.imageUrl === 'string' || raw.imageUrl === null ? { imageUrl: raw.imageUrl } : {}),
    ...(typeof raw.basePrice === 'number' ? { basePrice: raw.basePrice } : {}),
    ...(typeof raw.estimatedTotal === 'number' ? { estimatedTotal: raw.estimatedTotal } : {}),
  } satisfies Omit<CartItem, 'displaySnapshot' | 'revalidationStatus' | 'requiresFileReupload' | 'priceChanged'>;
  const previousSnapshot = raw.displaySnapshot;
  const displaySnapshot = createCartDisplaySnapshot(base, {
    ...(previousSnapshot?.title || raw.name ? { title: previousSnapshot?.title || raw.name || '' } : {}),
    imageUrl: previousSnapshot?.imageUrl ?? raw.imageUrl ?? null,
    ...(previousSnapshot?.summary ? { summary: previousSnapshot.summary } : {}),
    ...(previousSnapshot?.fileNames ? { fileNames: previousSnapshot.fileNames } : {}),
    ...(previousSnapshot?.estimatedTotalCents !== undefined ? { estimatedTotalCents: previousSnapshot.estimatedTotalCents } : {}),
    ...(previousSnapshot?.estimatedUnitCents !== undefined ? { estimatedUnitCents: previousSnapshot.estimatedUnitCents } : {}),
    ...(previousSnapshot?.calculatedAt ? { calculatedAt: previousSnapshot.calculatedAt } : {}),
    ...(previousSnapshot?.pricingVersion !== undefined ? { pricingVersion: previousSnapshot.pricingVersion } : {}),
    ...(previousSnapshot?.isEstimate !== undefined ? { isEstimate: previousSnapshot.isEstimate } : {}),
    ...(previousSnapshot?.configurationFingerprint ? { configurationFingerprint: previousSnapshot.configurationFingerprint } : {}),
  });
  const hasFileSnapshot = legacyFileIds.length > 0 || displaySnapshot.fileNames.length > 0;
  return {
    ...base,
    displaySnapshot,
    revalidationStatus: raw.revalidationStatus || (hasFileSnapshot ? 'requires_file_reupload' : 'pending'),
    requiresFileReupload: Boolean(raw.requiresFileReupload || hasFileSnapshot),
    priceChanged: Boolean(raw.priceChanged),
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (item) => set((state) => {
        const id = crypto.randomUUID();
        const normalized: CartItem = {
          ...item,
          id,
          bindingFileIds: item.bindingFileIds ?? [],
          displaySnapshot: createCartDisplaySnapshot(item, item.displaySnapshot),
          revalidationStatus: 'pending',
          requiresFileReupload: false,
          priceChanged: false,
        };
        saveSessionFiles(id, normalized.fileIds, normalized.bindingFileIds ?? []);
        return { items: [...state.items, normalized] };
      }),

      removeItem: (id) => set((state) => {
        removeSessionFiles(id);
        return { items: state.items.filter((item) => item.id !== id) };
      }),

      updateQuantity: (id, quantity) => set((state) => ({
        items: state.items.map((item) => item.id === id
          ? {
            ...item,
            quantity: Math.max(1, quantity),
            revalidationStatus: 'pending',
            priceChanged: false,
          }
          : item),
      })),

      restoreSessionFiles: () => set((state) => {
        const fileIntents = readSessionFileIntents();
        return {
          items: state.items.map((item) => {
            const files = fileIntents[item.id];
            const hasExpectedFiles = item.displaySnapshot.fileNames.length > 0 || item.requiresFileReupload;
            if (!files || files.fileIds.length === 0) {
              return {
                ...item,
                fileIds: [],
                bindingFileIds: [],
                requiresFileReupload: hasExpectedFiles,
                revalidationStatus: hasExpectedFiles ? 'requires_file_reupload' : item.revalidationStatus,
              };
            }
            return {
              ...item,
              fileIds: files.fileIds,
              bindingFileIds: files.bindingFileIds.filter((fileId) => files.fileIds.includes(fileId)),
              requiresFileReupload: false,
              revalidationStatus: 'pending',
            };
          }),
        };
      }),

      applyRevalidation: (id, patch) => set((state) => ({
        items: state.items.map((item) => {
          if (item.id !== id) return item;
          const snapshot = patch.displaySnapshot
            ? {
              ...patch.displaySnapshot,
              configurationFingerprint: cartConfigurationFingerprint(item),
            }
            : item.displaySnapshot;
          return {
            ...item,
            displaySnapshot: snapshot,
            revalidationStatus: patch.revalidationStatus,
            requiresFileReupload: patch.requiresFileReupload ?? item.requiresFileReupload,
            priceChanged: patch.priceChanged ?? item.priceChanged,
          };
        }),
      })),

      clearCart: () => {
        removeSessionFiles();
        set({ items: [] });
      },
    }),
    {
      name: 'jk-cart-storage',
      version: 3,
      migrate: (persistedState) => {
        const state = persistedState as { items?: Partial<CartItem>[] };
        return {
          ...state,
          items: (state.items || []).map(normalizePersistedItem),
        };
      },
      partialize: (state) => ({
        // Persist only a non-authoritative intent plus its visual snapshot.
        // Upload IDs remain in sessionStorage, and totals never reach checkout.
        items: state.items.map((item): PersistedCartItem => ({
          id: item.id,
          ...(item.serviceId ? { serviceId: item.serviceId } : {}),
          ...(item.productId ? { productId: item.productId } : {}),
          attributeIds: item.attributeIds,
          fieldValues: item.fieldValues.map(({ fieldKey, value, label, selectedOption }) => ({
            fieldKey,
            value,
            ...(label ? { label } : {}),
            ...(selectedOption ? { selectedOption } : {}),
          })),
          pageCount: item.pageCount,
          quantity: item.quantity,
          isFrontAndBack: item.isFrontAndBack,
          displaySnapshot: item.displaySnapshot,
          revalidationStatus: item.displaySnapshot.fileNames.length > 0 ? 'requires_file_reupload' : 'pending',
          requiresFileReupload: item.fileIds.length > 0 || item.displaySnapshot.fileNames.length > 0,
          priceChanged: item.priceChanged,
          ...(item.type ? { type: item.type } : {}),
        })),
      }),
    },
  ),
);
