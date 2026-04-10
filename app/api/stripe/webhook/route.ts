import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeKey, { apiVersion: "2026-03-25.dahlia" });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  async function updateProfile(customerId: string, plan: string, subscriptionId?: string) {
    if (!supabaseUrl || !serviceKey) return;
    await fetch(`${supabaseUrl}/rest/v1/profiles?stripe_customer_id=eq.${customerId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ plan, stripe_subscription_id: subscriptionId }),
    });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as { customer: string; id: string; status: string };
      const plan = sub.status === "active" ? "pro" : "free";
      await updateProfile(sub.customer as string, plan, sub.id);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as { customer: string };
      await updateProfile(sub.customer as string, "free");
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object as { customer_email?: string; customer?: string; subscription?: string };
      // Link email to stripe customer if profile exists
      if (session.customer_email && session.customer && supabaseUrl && serviceKey) {
        await fetch(
          `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(session.customer_email)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
            }),
          }
        );
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
