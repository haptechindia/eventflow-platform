import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const expectedSecret = Deno.env.get("NOTIFICATION_WORKER_SECRET");
  if (!expectedSecret || req.headers.get("x-worker-secret") !== expectedSecret) {
    return json({ error: "Unauthorized worker." }, 401);
  }

  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const graphVersion = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v27.0";
  if (!token || !phoneNumberId) return json({ error: "WhatsApp Cloud API is not configured." }, 500);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: jobs, error } = await admin.from("notification_outbox")
    .select("*").in("status", ["queued", "failed"]).lt("attempts", 5)
    .order("created_at", { ascending: true }).limit(25);
  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    await admin.from("notification_outbox").update({ status: "processing", attempts: job.attempts + 1 }).eq("id", job.id);
    try {
      const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: job.recipient.replace(/\D/g, ""),
          type: "template",
          template: {
            name: job.template_name,
            language: { code: job.language_code },
            components: [{ type: "body", parameters: (job.template_parameters ?? []).map((value: string) => ({ type: "text", text: String(value ?? "") })) }],
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message ?? "WhatsApp API request failed");
      await admin.from("notification_outbox").update({
        status: "sent", provider_message_id: result?.messages?.[0]?.id ?? null,
        sent_at: new Date().toISOString(), last_error: null,
      }).eq("id", job.id);
      sent++;
    } catch (err) {
      await admin.from("notification_outbox").update({ status: "failed", last_error: String(err).slice(0, 1000) }).eq("id", job.id);
      failed++;
    }
  }
  return json({ processed: (jobs ?? []).length, sent, failed });
});
