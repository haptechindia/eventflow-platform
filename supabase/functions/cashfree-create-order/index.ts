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

  const baseUrl = environment === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

  try {
    const body = await req.json();
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1. Direct Server-side Verification for Platform Fee Order
    if (body.action === "verify_platform_fee" || body.order_type === "verify_platform_fee") {
      const orderId = body.order_id;
      if (!orderId || typeof orderId !== "string") {
        return json({ error: "order_id is required for verification." }, 400);
      }
      const cfRes = await fetch(`${baseUrl}/orders/${orderId}`, {
        headers: {
          "x-api-version": "2025-01-01",
          "x-client-id": appId,
          "x-client-secret": secret,
        },
      });
      const cfData = await cfRes.json();
      if (!cfRes.ok) {
        return json({ error: cfData?.message || "Failed to fetch order status from Cashfree." }, 502);
      }

      if (cfData.order_status === "PAID") {
        const { data: confirmData, error: confirmErr } = await admin.rpc("confirm_platform_fee_payment", {
          p_provider_order_id: orderId,
          p_provider_payment_id: String(cfData.cf_order_id || cfData.order_id || ""),
          p_paid_amount: Number(cfData.order_amount || 999.00),
        });
        if (confirmErr) {
          console.error("confirm_platform_fee_payment RPC error:", confirmErr);
          return json({ error: confirmErr.message }, 500);
        }
        return json({ verified: true, status: "paid", data: confirmData });
      }

      return json({ verified: false, status: cfData.order_status });
    }

    // 2. Platform Event Creation Fee Flow (₹999 per event after free quota)
    if (body.order_type === "event_platform_fee") {
      const { event_id } = body;
      if (!event_id || typeof event_id !== "string") {
        return json({ error: "event_id is required." }, 400);
      }

      const { data: event, error: eventErr } = await admin
        .from("events")
        .select("id, organization_id, name, billing_type, billing_status, platform_fee_amount")
        .eq("id", event_id)
        .single();

      if (eventErr || !event) return json({ error: "Event not found." }, 404);
      if (event.billing_status === "paid") {
        return json({ error: "The platform access fee for this event is already paid." }, 409);
      }

      const { data: org } = await admin
        .from("organizations")
        .select("id, name")
        .eq("id", event.organization_id)
        .single();

      // Check existing pending order for this event
      const { data: existing } = await admin
        .from("platform_fee_orders")
        .select("provider_order_id, payment_session_id, status, amount")
        .eq("event_id", event.id)
        .in("status", ["created", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.payment_session_id) {
        return json({
          order_id: existing.provider_order_id,
          payment_session_id: existing.payment_session_id,
          amount: existing.amount,
        });
      }

      const orderId = `ef_fee_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
      const fixedAmount = 999.00;

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
          order_amount: fixedAmount,
          order_currency: "INR",
          customer_details: {
            customer_id: event.organization_id,
            customer_name: (org?.name || event.name).slice(0, 50),
            customer_email: "support@eventflow.org",
            customer_phone: "9999999999",
          },
          order_meta: {
            return_url: `${siteUrl.replace(/\/$/, "")}/admin?billing_return=1&event_id=${event.id}&order_id={order_id}`,
            notify_url: `${supabaseUrl}/functions/v1/cashfree-webhook`,
            payment_methods: "cc,dc,upi,nb",
          },
          order_note: `EventFlow Event Platform Fee - ${event.name.slice(0, 30)}`,
          order_tags: {
            category: "EVENT_PLATFORM_FEE",
            product: "EventFlow Event Creation Fee",
            event_id: event.id,
            organization_id: event.organization_id,
          },
        }),
      });

      const cf = await cashfreeResponse.json();
      if (!cashfreeResponse.ok || !cf.payment_session_id) {
        console.error("Cashfree create platform fee order failed", cf);
        return json({ error: "Cashfree could not create the platform fee order. Please retry." }, 502);
      }

      const { error: insertError } = await admin.from("platform_fee_orders").insert({
        organization_id: event.organization_id,
        event_id: event.id,
        provider: "cashfree",
        provider_order_id: orderId,
        payment_session_id: cf.payment_session_id,
        amount: fixedAmount,
        currency: "INR",
        status: "pending",
        provider_payload: { cf_order_id: cf.cf_order_id ?? null },
      });

      if (insertError) {
        console.error("Could not persist platform fee order", insertError);
        return json({ error: "Order was created with payment provider but could not be saved." }, 500);
      }

      await admin.from("events").update({
        platform_fee_order_id: orderId,
      }).eq("id", event.id);

      return json({
        order_id: orderId,
        payment_session_id: cf.payment_session_id,
        amount: fixedAmount,
      });
    }

    // 3. Participant Registration Ticket Payment Flow
    const { registration_code } = body;
    if (typeof registration_code !== "string" || registration_code.length < 8) {
      return json({ error: "A valid registration code is required." }, 400);
    }

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
          return_url: `${siteUrl.replace(/\/$/, "")}/payment-return?order_id={order_id}&code=${encodeURIComponent(reg.registration_code)}`,
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
