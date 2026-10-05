import { backendEnabled } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Liveness probe for Docker / load balancers. */
export function GET() {
  return Response.json({ ok: true, backend: backendEnabled() });
}
