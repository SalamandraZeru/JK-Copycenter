// Lado do navegador das notificações push (usado só em componentes cliente).

export type PushAvailability = 'available' | 'denied' | 'ios-install' | 'unsupported';

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function pushAvailability(): PushAvailability {
  if (typeof window === 'undefined') return 'unsupported';
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  // No iPhone o push só existe com o site instalado na tela de início (iOS 16.4+).
  if (isIos() && !isStandalone()) return 'ios-install';
  if (!supported || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'available';
}

function applicationServerKey(): Uint8Array<ArrayBuffer> {
  const value = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** Pede permissão e devolve a inscrição deste aparelho (reaproveita se já existir). */
export async function subscribeThisDevice(): Promise<PushSubscriptionJSON> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'PUSH_DENIED' : 'PUSH_DISMISSED');
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(),
  });
  return subscription.toJSON();
}

export async function currentDeviceSubscription(): Promise<PushSubscription | null> {
  if (pushAvailability() !== 'available' || Notification.permission !== 'granted') return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}
