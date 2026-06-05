import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase-server";

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

  const supabase = createAdminClient();

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as { customer: string; id: string; status: string };
      const plan = sub.status === "active" ? "pro" : "free";
      await supabase
        .from("profiles")
        .update({ plan, stripe_subscription_id: sub.id })
        .eq("stripe_customer_id", sub.customer);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as { customer: string };
      await supabase
        .from("profiles")
        .update({ plan: "free", stripe_subscription_id: null })
        .eq("stripe_customer_id", sub.customer);
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object as { customer_email?: string; customer?: string; subscription?: string };
      if (session.customer_email && session.customer) {
        await supabase
          .from("profiles")
          .update({
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription ?? null,
          })
          .eq("email", session.customer_email);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
