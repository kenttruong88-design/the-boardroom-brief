export default function PlausibleScript() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const host = process.env.NEXT_PUBLIC_PLAUSIBLE_HOST ?? "https://plausible.io";

  if (!domain) return null;

  return (
    <script
      defer
      data-domain={domain}
      src={`${host}/js/script.js`}
    />
  );
}
