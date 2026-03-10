import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Kiwify product → plan mapping
const PRODUCT_MAP: Record<string, { plan: string; validUntil: string | null }> = {
  "7eaccdd0-1c0e-11f1-8b08-97a930f3e7cf": {
    plan: "anual_vip",
    validUntil: "2026-12-31T23:59:59Z",
  },
  "458c4910-1c02-11f1-93f9-81fb1e6c85e3": {
    plan: "mensal_avulso",
    validUntil: null, // calculated as +30 days
  },
  "547bf0b0-1c0c-11f1-b72f-9f232a34d137": {
    plan: "mensal_recorrente",
    validUntil: null, // calculated as +30 days
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    console.log("Kiwify webhook received:", JSON.stringify(payload));

    // Kiwify sends order_status or event type
    const orderStatus = payload.order_status || payload.subscription_status;
    if (orderStatus !== "paid" && orderStatus !== "active") {
      console.log("Ignoring non-paid event:", orderStatus);
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract customer email and product ID
    const email = (
      payload.Customer?.email ||
      payload.customer?.email ||
      ""
    ).toLowerCase().trim();

    const productId =
      payload.Product?.id ||
      payload.product?.id ||
      payload.product_id ||
      "";

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing customer email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mapping = PRODUCT_MAP[productId];
    if (!mapping) {
      console.log("Unknown product ID:", productId);
      return new Response(JSON.stringify({ error: "Unknown product" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate valid_until
    let validUntil = mapping.validUntil;
    if (!validUntil) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      validUntil = d.toISOString();
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user by email in auth.users
    const { data: usersData, error: listErr } =
      await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    if (listErr) {
      console.error("Error listing users:", listErr);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = usersData.users.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (!user) {
      console.log("User not found for email:", email);
      // Still return 200 so Kiwify doesn't retry endlessly
      return new Response(
        JSON.stringify({ ok: true, message: "User not registered yet" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert subscription
    const { error: upsertErr } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan: mapping.plan,
          valid_until: validUntil,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Subscription updated: ${email} → ${mapping.plan} until ${validUntil}`);

    return new Response(
      JSON.stringify({ ok: true, email, plan: mapping.plan, valid_until: validUntil }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
