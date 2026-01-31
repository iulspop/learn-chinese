import { clearWordIndexCache } from "~/lib/words.server";

export async function action({ request }: { request: Request }) {
  const pythonUrl = process.env.PYTHON_API_URL || "http://localhost:5001";
  const body = await request.text();
  const res = await fetch(`${pythonUrl}/generate-cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) {
    return new Response(res.body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = res.body;
  if (!upstream) {
    return new Response("No response body", { status: 502 });
  }

  const reader = upstream.getReader();
  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        clearWordIndexCache();
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
