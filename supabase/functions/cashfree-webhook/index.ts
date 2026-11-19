import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function toHex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
async function verifySignature(rawBody: string, timestamp: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + rawBody));
  const expected = fromBase64(btoa(String.fromCharCode(...new Uint8Array(signed))));
  const actual = fromBase64(signature);
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawBody = await req.text();
  const signature = req.headers.get("x-webhook-signature") ?? "";
  const timestamp = req.headers.get("x-webhook-timestamp") ?? "";
  const secret = Deno.env.get("CASHFREE_SECRET_KEY");
  if (!secret || !signature || !timestamp) return new Response("Missing signature headers", { status: 400 });
  if (!await verifySignature(rawBody, timestamp, signature, secret)) return new Response("Invalid signature", { status: 401 });

  try {
    const payload = JSON.parse(rawBody);
    const orderId = payload?.data?.order?.order_id;
    const payment = payload?.data?.payment;
    if (!orderId || !payment) return new Response("Ignored event", { status: 200 });
    if (payment.payment_status !== "SUCCESS") return new Response("Payment not successful", { status: 200 });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await supabase.rpc("confirm_cashfree_payment", {
      p_provider_order_id: orderId,
      p_provider_payment_id: String(payment.cf_payment_id ?? ""),
      p_paid_amount: Number(payment.payment_amount),
    });
    if (error) {
      console.error("Cashfree payment confirmation failed", error.message);
      return new Response("Payment confirmation failed", { status: 500 });
    }
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Webhook processing failed", { status: 500 });
  }
});
