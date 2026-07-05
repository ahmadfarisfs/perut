/* Daily check-in reminders.
   Runs from .github/workflows/reminders.yml. Finds every user whose latest
   check-in is older than REMIND_AFTER_DAYS (or who never checked in) and
   sends a web push to each of their registered devices.

   Deliberately a silent no-op while setup is incomplete: missing secrets or
   a missing VAPID public key just print a notice and exit 0, so the
   scheduled workflow never goes red before the feature is configured. */
import webpush from "web-push";
import { readFileSync } from "node:fs";

const REMIND_AFTER_DAYS = 5;

const cfgSrc = readFileSync(new URL("../config.js", import.meta.url), "utf8");
const cfgValue = (key) => (cfgSrc.match(new RegExp(key + String.raw`:\s*"([^"]*)"`)) || [])[1] || "";

const SUPABASE_URL = cfgValue("supabaseUrl");
const VAPID_PUBLIC_KEY = cfgValue("vapidPublicKey");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (!SUPABASE_URL || !VAPID_PUBLIC_KEY) {
  console.log("Setup incomplete (supabaseUrl or vapidPublicKey missing in config.js) — skipping.");
  process.exit(0);
}
if (!SERVICE_KEY || !VAPID_PRIVATE_KEY) {
  console.log("Setup incomplete (VAPID_PRIVATE_KEY or SUPABASE_SERVICE_ROLE_KEY secret missing) — skipping.");
  process.exit(0);
}

webpush.setVapidDetails("mailto:owner@perut-tracker.invalid", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const headers = {
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
  "content-type": "application/json",
};

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers, ...init });
  if (!res.ok) throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const users = await rest("users?select=id,name");
const subs = await rest("push_subscriptions?select=id,user_id,endpoint,p256dh,auth");
const measurements = await rest("measurements?select=user_id,measured_at&order=measured_at.desc&limit=5000");

const latestByUser = {};
for (const m of measurements) {
  if (!(m.user_id in latestByUser)) latestByUser[m.user_id] = new Date(m.measured_at).getTime();
}

const cutoff = Date.now() - REMIND_AFTER_DAYS * 86400000;
let sent = 0, pruned = 0;

for (const user of users) {
  const userSubs = subs.filter((s) => s.user_id === user.id);
  if (!userSubs.length) continue;

  const last = latestByUser[user.id];
  if (last && last >= cutoff) continue;

  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  const body = days
    ? `${user.name}, sudah ${days} hari tanpa check-in. Jangan kendor — catat sekarang.`
    : `${user.name}, belum ada check-in pertama. Mulai hari ini.`;
  const payload = JSON.stringify({ title: "Perut Tracker", body });

  for (const sub of userSubs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
      console.log(`Reminded ${user.name} (${days ?? "no"} days).`);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Device revoked/expired the subscription — prune it.
        await rest(`push_subscriptions?id=eq.${sub.id}`, { method: "DELETE" });
        pruned++;
        console.log(`Pruned dead subscription for ${user.name}.`);
      } else {
        console.error(`Push to ${user.name} failed:`, err.statusCode || err.message);
        process.exitCode = 1;
      }
    }
  }
}

console.log(`Done. ${sent} reminder(s) sent, ${pruned} dead subscription(s) pruned.`);
