import { pool } from "@workspace/db";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const domain = process.env["REPLIT_DEV_DOMAIN"]!;

const su = await pool.query(
  `SELECT id, email FROM app_users WHERE role='superadmin' ORDER BY id LIMIT 1`,
);
console.log("superadmin rows:", su.rows.length);
if (!su.rows.length) {
  await pool.end();
  process.exit(1);
}
const uid = su.rows[0].id as number;
const email = su.rows[0].email as string;

const sid = `repro-403-${randomUUID()}`;
const sess = JSON.stringify({
  userId: uid,
  email,
  name: "Repro",
  avatarUrl: null,
  tenantId: null,
  role: "superadmin",
  permissions: {},
  isAdmin: true,
  appUserRole: "superadmin",
});
await pool.query(
  `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1,$2, now() + interval '10 minutes')`,
  [sid, sess],
);

const invite = readFileSync("/tmp/invite.html", "utf8");
const cookie = `lp_sid=${sid}`;

async function hit(label: string, body: unknown): Promise<void> {
  const r = await fetch(
    `https://${domain}/api/admin/notification-templates/welcome/preview`,
    {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    },
  );
  const text = await r.text();
  console.log(
    `\n[${label}] status=${r.status} len=${text.length} ctype=${r.headers.get("content-type")}`,
  );
  console.log(text.slice(0, 300).replace(/\n/g, " "));
}

await hit("LARGE magazine bodyHtml", {
  bodyHtml: invite,
  wrapInShell: false,
  emailSubject: "Test {{tenantName}}",
});
await hit("SMALL bodyHtml", {
  bodyHtml: "<p>hi {{tenantName}}</p>",
  wrapInShell: false,
  emailSubject: "Test",
});
await hit("DEFAULT (uses DB welcome)", { emailSubject: "Test" });

await pool.query(`DELETE FROM app_sessions WHERE sid=$1`, [sid]);
console.log("\ncleaned up session");
await pool.end();