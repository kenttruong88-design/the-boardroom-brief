export async function GET() {
  if (process.env.NODE_ENV !== "production") {
    return Response.json({ error: "Only available in production" }, { status: 403 });
  }
  // Delete this route after verifying Sentry receives the error
  throw new Error("Sentry test error — delete this route after verification");
}
