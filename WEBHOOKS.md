# Inbound Webhook URLs (per-tenant)

The lp-studio API exposes three public webhook endpoints used by third-party
visitor-identification trackers:

| Integration | URL                                              |
|-------------|--------------------------------------------------|
| RB2B        | `POST /api/webhooks/rb2b/<secret>`               |
| Apollo      | `POST /api/webhooks/apollo/<secret>`             |
| Letterdrop  | `POST /api/webhooks/letterdrop/<secret>`         |

Each `<secret>` is unique per `(tenant, integration)` and is stored in the
`tenant_webhook_secrets` table. The handler resolves the tenant from the
secret; **unknown secrets return 404 with no body** so an attacker can't
probe whether a tenant has a given integration enabled.

There is no `tenantId: 1` fallback. A request without a valid secret never
writes a signal anywhere.

## Looking up a tenant's URL

```sql
SELECT integration, secret
  FROM tenant_webhook_secrets
 WHERE tenant_id = <id>;
```

Then construct the URL as
`https://<api-host>/api/webhooks/<integration>/<secret>`.

## Provisioning a new tenant

Generate a secret with the same scheme used in the seeder:

```sql
-- secret should be crypto.randomBytes(24).toString("base64url") (~32 chars)
INSERT INTO tenant_webhook_secrets (tenant_id, integration, secret)
VALUES (<tenant_id>, 'rb2b',       '<random-base64url>'),
       (<tenant_id>, 'apollo',     '<random-base64url>'),
       (<tenant_id>, 'letterdrop', '<random-base64url>');
```

Then paste each URL into the corresponding RB2B / Apollo / Letterdrop
dashboard for that tenant.

## Rotation

Rotate by deleting the row and inserting a new secret in one transaction,
then update the third-party dashboard with the new URL. There is currently
no scheduled rotation — see the follow-up backlog.

## Dandy bootstrap

On first boot after task #147, the api-server seeds three secrets for
tenant #1 (Dandy) and logs each new URL at `WARN` level so the operator
can copy them into the existing RB2B / Apollo / Letterdrop trackers. The
seed is guarded by the `dandy_webhook_secrets_v1` migration marker — it
never re-runs on subsequent boots and will not overwrite a manually-rotated
secret.
