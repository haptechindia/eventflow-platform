import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appId = Deno.env.get("CASHFREE_APP_ID");
  const secret = Deno.env.get("CASHFREE_SECRET_KEY");
  const siteUrl = Deno.env.get("SITE_URL");
  const environment = Deno.env.get("CASHFREE_ENV") ?? "sandbox";
  if (!appId || !secret || !siteUrl) return json({ error: "Cashfree server configuration is incomplete." }, 500);

  try {
    const { registration_code } = await req.json();
    if (typeof registration_code !== "string" || registration_code.length < 8) {
      return json({ error: "A valid registration code is required." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: reg, error: regError } = await admin
      .from("registrations").select("id,event_id,registration_code,full_name,email,phone,amount_due,payment_status,whatsapp_opt_in")
      .eq("registration_code", registration_code.trim().toUpperCase()).single();
    if (regError || !reg) return json({ error: "Registration not found." }, 404);
    if (reg.payment_status === "verified") return json({ error: "This registration is already paid." }, 409);
    if (reg.payment_status === "rejected") return json({ error: "This registration was rejected. Contact the organiser." }, 409);

    const { data: event, error: eventError } = await admin
      .from("events").select("id,name,slug,currency,platform_fee_enabled,platform_fee_percent,cashfree_enabled,status")
      .eq("id", reg.event_id).single();
    if (eventError || !event || event.status !== "published" || !event.cashfree_enabled) {
      return json({ error: "Online Cashfree payment is not enabled for this event." }, 409);
    }
    if (event.currency !== "INR") return json({ error: "The central Cashfree checkout currently supports INR events only." }, 400);

    const base = Number(reg.amount_due);
    const fee = event.platform_fee_enabled ? Math.round(base * Number(event.platform_fee_percent) * 100) / 10000 : 0;
    const total = Math.round((base + fee) * 100) / 100;
    if (!Number.isFinite(total) || total <= 0) return json({ error: "Invalid payment amount." }, 400);

    const { data: existing } = await admin.from("payment_orders")
      .select("provider_order_id,payment_session_id,status,total_amount")
      .eq("registration_id", reg.id).in("status", ["created", "pending"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing?.payment_session_id) {
      return json({ order_id: existing.provider_order_id, payment_session_id: existing.payment_session_id, amount: existing.total_amount });
    }

    const orderId = `ef_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
    const baseUrl = environment === "production"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";
    const cashfreeResponse = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2025-01-01",
        "x-client-id": appId,
        "x-client-secret": secret,
        "x-idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: total,
        order_currency: "INR",
        customer_details: {
          customer_id: reg.id,
          customer_name: reg.full_name,
          customer_email: reg.email,
          customer_phone: reg.phone.replace(/\D/g, "").slice(-10),
        },
        order_meta: {
          return_url: `${siteUrl.replace(/\/$/, "")}/payment-return?order_id={order_id}`,
          notify_url: `${supabaseUrl}/functions/v1/cashfree-webhook`,
        },
        order_note: `EventFlow registration ${reg.registration_code}`,
      }),
    });
    const cf = await cashfreeResponse.json();
    if (!cashfreeResponse.ok || !cf.payment_session_id) {
      console.error("Cashfree create order failed", cf);
      return json({ error: "Cashfree could not create the payment order. Please retry or contact the organiser." }, 502);
    }

    const { error: insertError } = await admin.from("payment_orders").insert({
      registration_id: reg.id, event_id: reg.event_id, provider_order_id: orderId,
      base_amount: base, platform_fee_amount: fee, total_amount: total,
      currency: "INR", payment_session_id: cf.payment_session_id, status: "pending",
      provider_payload: { cf_order_id: cf.cf_order_id ?? null },
    });
    if (insertError) {
      console.error("Could not persist Cashfree order", insertError);
      return json({ error: "Payment order was created but could not be saved. Contact support before retrying." }, 500);
    }
    return json({ order_id: orderId, payment_session_id: cf.payment_session_id, amount: total, base_amount: base, platform_fee: fee });
  } catch (error) {
    console.error(error);
    return json({ error: "Unable to start payment." }, 500);
  }
});
