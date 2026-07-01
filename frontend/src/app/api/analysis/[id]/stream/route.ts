import { auth } from "@clerk/nextjs/server";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND = process.env.API_URL ?? "http://backend:8000";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const upstream = await fetch(
    `${BACKEND}/analysis/${id}/stream?token=${encodeURIComponent(token)}`,
    {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
      },
    },
  ).catch(() => null);

  if (!upstream || upstream.status !== 200 || !upstream.body) {
    return new Response("Backend unavailable", {
      status: upstream?.status ?? 502,
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
