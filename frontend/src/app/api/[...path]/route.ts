import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND = process.env.API_URL ?? "http://backend:8000";

// Headers that must not be forwarded upstream or back to the client
const DROP_REQUEST = new Set([
  "host",
  "connection",
  "transfer-encoding",
  "keep-alive",
  "te",
  "trailer",
  "upgrade",
]);

const DROP_RESPONSE = new Set([
  "connection",
  "transfer-encoding",
  "keep-alive",
]);

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
  method: string,
): Promise<NextResponse> {
  const { path } = await params;
  const search = request.nextUrl.search;
  const url = `${BACKEND}/${path.join("/")}${search}`;

  const forwardHeaders = new Headers();
  request.headers.forEach((value, key) => {
    if (!DROP_REQUEST.has(key.toLowerCase())) {
      forwardHeaders.set(key, value);
    }
  });

  const hasBody = !["GET", "HEAD", "DELETE"].includes(method);

  try {
    const upstream = await fetch(url, {
      method,
      headers: forwardHeaders,
      body: hasBody ? request.body : undefined,
      // @ts-expect-error — duplex required by Node.js fetch for streaming request bodies
      duplex: "half",
    });

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!DROP_RESPONSE.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ detail: "Gateway error" }, { status: 502 });
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export const GET    = (req: NextRequest, ctx: Ctx) => proxy(req, ctx, "GET");
export const POST   = (req: NextRequest, ctx: Ctx) => proxy(req, ctx, "POST");
export const PATCH  = (req: NextRequest, ctx: Ctx) => proxy(req, ctx, "PATCH");
export const PUT    = (req: NextRequest, ctx: Ctx) => proxy(req, ctx, "PUT");
export const DELETE = (req: NextRequest, ctx: Ctx) => proxy(req, ctx, "DELETE");
export const HEAD   = (req: NextRequest, ctx: Ctx) => proxy(req, ctx, "HEAD");
