---
name: Integration credential encryption at rest
description: AES-256-GCM envelope for lp_integrations.config secrets — read/write coordination, double-encrypt trap, ordering rules
---

Integration credential fields in `lp_integrations.config` (jsonb) are encrypted
at rest with AES-256-GCM. Envelope is `v1:` + base64(iv‖ciphertext‖authTag); key
comes from `CREDENTIAL_ENCRYPTION_KEY` (32 raw bytes, base64). The helper lives in
the api-server lib; a per-provider whitelist names which fields are secret.

**The lockstep contract (the durable rule):** encryption only holds if EVERY
write of a config encrypts and EVERY read that uses a config decrypts. Writes are
centralized in the upsert helper; reads happen in multiple readers (the route
getter, the export-destinations getter, the asana config getter) — downstream
sync code must consume an already-decrypted config from a reader, never read the
DB directly. Adding a provider or a new secret field = update the whitelist AND
make sure that provider's reader decrypts.
**Why:** a missed read site silently uses ciphertext as a live secret; a missed
write site silently stores plaintext. Neither fails loudly.

**Masked-resave double-encrypt trap:** the Settings save merges the incoming
config over the stored one and keeps the existing secret when the UI sends a
masked placeholder. That merged config is then re-encrypted on write. If the read
path returned the still-encrypted value, re-encryption would nest envelopes
(`v1:v1:…`) and corrupt the secret. Two guards: the route getter decrypts on read,
AND the config-encrypt step skips values already carrying the `v1:` prefix.
**How to apply:** keep both guards; an integration test exercises the masked
re-save path specifically.

**Ordering / migration safety:** decrypt treats any non-`v1:` (or empty) value as
plaintext and returns it unchanged. This is what lets the decrypt-on-read code
ship safely BEFORE the one-time backfill encrypts existing rows. The backfill
script is idempotent (skips `v1:` rows) and refuses to run without the key in
non-prod (running with the dev fallback would write undecryptable data).

**Boot guard:** in production, startup fails if the key is unset, AND eagerly
decodes + length-checks it so a malformed key fails at boot, not on first write.
Dev/test run on a loud deterministic dev fallback key on purpose.

**Test-mounting gotcha:** the lp index router's handlers already declare full
`/lp/...` paths, so an in-process inject() test must mount it at ROOT, not under
`/lp` (that double-prefixes to `/lp/lp/...` → 404).

SFDC connection OAuth tokens are NOT encrypted yet (OAuth not live); the schema
comment flags wrapping them with the same helper before storing real tokens.
