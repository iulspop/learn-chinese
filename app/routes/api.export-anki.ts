export async function action({ request }: { request: Request }) {
  const pythonUrl = process.env.PYTHON_API_URL || "http://localhost:5001";
  const body = await request.text();
  const res = await fetch(`${pythonUrl}/export-anki`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/octet-stream",
      "Content-Disposition": res.headers.get("Content-Disposition") || "",
    },
  });
}
