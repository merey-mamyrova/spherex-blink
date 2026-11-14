// Vercel serverless function: forwards /irsa/<path>?<query> to the NASA/IPAC archive (IRSA).
// The archive does not allow browsers to call it from another site, so the site calls this instead.
// Only the two archive services the site needs are allowed.
const IRSA = "https://irsa.ipac.caltech.edu/";

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.searchParams.get("path") || "";
  url.searchParams.delete("path");
  if (!/^(TAP\/|ibe\/)/.test(path) || path.includes("..")) {
    res.statusCode = 403;
    return res.end("path not allowed");
  }
  const qs = url.searchParams.toString();
  let up;
  try {
    up = await fetch(IRSA + path + (qs ? "?" + qs : ""), { headers: { "User-Agent": "spherex-blink/1.0" } });
  } catch (e) {
    res.statusCode = 503;
    return res.end("archive unreachable");
  }
  res.statusCode = up.status;
  res.setHeader("Content-Type", up.headers.get("content-type") || "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=3600");
  if (!up.body) return res.end();
  const reader = up.body.getReader();
  req.on("close", () => reader.cancel().catch(() => {}));
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch (e) { /* the page stopped reading early: expected */ }
  res.end();
};
