import jwt from "jsonwebtoken";
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { from, to, services } = req.body;

  if (!from || !to || !Array.isArray(services)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  // 1️⃣ Создаём JWT для GitHub App
  const appJwt = jwt.sign(
    {
      iss: process.env.GITHUB_APP_ID,
      iat: Math.floor(Date.now() / 1000) - 60,
      exp: Math.floor(Date.now() / 1000) + 600
    },
    process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
    { algorithm: "RS256" }
  );

  // 2️⃣ Получаем installation token
  const instRes = await fetch(
    `https://api.github.com/app/installations/${process.env.GITHUB_INSTALLATION_ID}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  const inst = await instRes.json();

  if (!inst.token) {
    return res.status(500).json({ error: "Failed to get installation token" });
  }

  const token = inst.token;

  // 3️⃣ Запускаем workflow_dispatch
  await fetch(
    "https://api.github.com/repos/danylo-sukhorukov/release-dashboard/actions/workflows/create-pull-requests.yml/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          from,
          to,
          services: services.join(",")
        }
      })
    }
  );

  return res.status(200).json({ ok: true });
}
