export default async function handler(req, res) {
  // CORS para que el navegador pueda llamar a /api/invoke
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { baseUrl, path, body } = req.body || {};

    if (!baseUrl || !path) {
      return res.status(400).json({ error: "Missing baseUrl or path" });
    }

    const targetUrl = `${baseUrl}${path}`;

    const awsResp = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {})
    });

    const text = await awsResp.text();

    // Intentar parsear JSON si aplica
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }

    // Devolvemos al cliente:
    // - status real de AWS
    // - body (parsed o raw)
    return res.status(200).json({
      ok: true,
      awsStatus: awsResp.status,
      awsBody: parsed ?? text
    });

  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Proxy error",
      details: String(e)
    });
  }
}
