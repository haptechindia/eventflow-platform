import { supabase } from './supabase'

let sdkPromise
function loadCashfreeSdk() {
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      if (window.Cashfree) return resolve(window.Cashfree)
      const script = document.createElement('script')
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
      script.async = true
      script.onload = () => resolve(window.Cashfree)
      script.onerror = () => reject(new Error('Unable to load Cashfree checkout.'))
      document.head.appendChild(script)
    })
  }
  return sdkPromise
}

/** Starts a server-priced Cashfree order for participant registration. */
export async function startCashfreeCheckout(registrationCode) {
  if (!supabase) throw new Error('Payment service is not configured.')
  const { data, error } = await supabase.functions.invoke('cashfree-create-order', {
    body: { registration_code: registrationCode },
  })
  if (error) throw error
  if (!data?.payment_session_id) throw new Error(data?.error || 'Cashfree did not return a payment session.')
  const Cashfree = await loadCashfreeSdk()
  const cashfree = Cashfree({ mode: import.meta.env.VITE_CASHFREE_MODE === 'production' ? 'production' : 'sandbox' })
  return cashfree.checkout({ paymentSessionId: data.payment_session_id, redirectTarget: '_self' })
}

/** Starts a ₹999 platform fee order to unlock a paid event. */
export async function startPlatformFeeCheckout(eventId) {
  if (!supabase) throw new Error('Payment service is not configured.')
  const { data, error } = await supabase.functions.invoke('cashfree-create-order', {
    body: { order_type: 'event_platform_fee', event_id: eventId },
  })
  if (error) throw error
  if (!data?.payment_session_id) throw new Error(data?.error || 'Cashfree did not return a payment session.')
  const Cashfree = await loadCashfreeSdk()
  const cashfree = Cashfree({ mode: import.meta.env.VITE_CASHFREE_MODE === 'production' ? 'production' : 'sandbox' })
  return cashfree.checkout({ paymentSessionId: data.payment_session_id, redirectTarget: '_self' })
}

/** Verifies platform fee order with Cashfree server-side. */
export async function verifyPlatformFeeOrder(orderId) {
  if (!supabase) throw new Error('Payment service is not configured.')
  const { data, error } = await supabase.functions.invoke('cashfree-create-order', {
    body: { action: 'verify_platform_fee', order_id: orderId },
  })
  if (error) throw error
  return data
}
