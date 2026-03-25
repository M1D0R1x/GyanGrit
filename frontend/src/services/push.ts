// services/push.ts
/**
 * Web Push notification subscription management.
 *
 * Flow:
 * 1. Fetch VAPID public key from backend
 * 2. Request notification permission from user
 * 3. Subscribe to push via service worker
 * 4. Send subscription to backend for storage
 *
 * Called from TopBar or DashboardPage after login.
 */
import { apiGet, apiPost } from "./api";

type VapidKeyResponse = { public_key: string };
type SubscribeResponse = { subscribed: boolean; id: number };

/**
 * Convert a base64 string to Uint8Array for applicationServerKey.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported and permission is granted.
 */
export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Get current permission state: "granted", "denied", or "default".
 */
export function getPushPermission(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

/**
 * Request permission and subscribe to push notifications.
 * Returns true if subscription was successful.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn("[Push] Not supported in this browser.");
    return false;
  }

  // 1. Request permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("[Push] Permission denied.");
    return false;
  }

  // 2. Get VAPID key
  let vapidKey: string;
  try {
    const res = await apiGet<VapidKeyResponse>("/notifications/push/vapid-key/");
    vapidKey = res.public_key;
    if (!vapidKey) {
      console.warn("[Push] No VAPID key configured on server.");
      return false;
    }
  } catch (err) {
    console.error("[Push] Failed to fetch VAPID key:", err);
    return false;
  }

  // 3. Get service worker registration
  const registration = await navigator.serviceWorker.ready;

  // 4. Subscribe via PushManager
  let subscription: PushSubscription;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    }) as PushSubscription;
  } catch (err) {
    console.error("[Push] Subscribe failed:", err);
    return false;
  }

  // 5. Extract keys and send to backend
  const subJson = subscription.toJSON();
  const p256dh = subJson.keys?.p256dh ?? "";
  const auth = subJson.keys?.auth ?? "";

  if (!p256dh || !auth) {
    console.error("[Push] Missing subscription keys.");
    return false;
  }

  try {
    await apiPost<SubscribeResponse>("/notifications/push/subscribe/", {
      endpoint: subscription.endpoint,
      p256dh,
      auth,
    });
    console.log("[Push] Subscribed successfully.");
    return true;
  } catch (err) {
    console.error("[Push] Failed to save subscription:", err);
    return false;
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true; // already unsubscribed

    // Unsubscribe from browser
    await subscription.unsubscribe();

    // Tell backend to remove the subscription
    await apiPost("/notifications/push/unsubscribe/", {
      endpoint: subscription.endpoint,
    });

    console.log("[Push] Unsubscribed.");
    return true;
  } catch (err) {
    console.error("[Push] Unsubscribe failed:", err);
    return false;
  }
}

/**
 * Check if already subscribed (has an active push subscription).
 */
export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
