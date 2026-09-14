export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = (
    request.headers.get("x-forwarded-proto") ||
    url.protocol.replace(":", "") ||
    "https"
  ).split(",")[0]!.trim();
  const host = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    url.host
  )
    .split(",")[0]!
    .trim();
  return `${proto}://${host}`.replace(/\/$/, "");
}

export function regionFrom(request: Request): string | null {
  return (
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-vercel-ip-country") ||
    null
  );
}
