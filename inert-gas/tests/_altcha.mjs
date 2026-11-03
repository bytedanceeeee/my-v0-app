// Test helper: solves the site's ALTCHA puzzle exactly like a browser would.
import crypto from "crypto";
export async function solveToken(dispatch) {
  const r = await dispatch("/api/altcha");
  if (r.status !== 200) return "unavailable"; // e.g. kill switch is on
  const ch = JSON.parse(await r.text());
  for (let n = 0; n <= ch.maxnumber; n++)
    if (crypto.createHash("sha256").update(ch.salt + n).digest("hex") === ch.challenge)
      return Buffer.from(JSON.stringify({ algorithm: ch.algorithm, challenge: ch.challenge, number: n, salt: ch.salt, signature: ch.signature })).toString("base64");
  throw new Error("no solution");
}
