# Sentry "no events" alert — production verification (task #190)

This file is the durable evidence trail for the runtime alarm that fires
when production stops sending events to Sentry — the blind spot that
task #189 uncovered (the api-server had been launching without its
Sentry initializer for an unknown amount of time and nobody noticed).

Refresh this doc whenever the heartbeat cadence, the alert rule, or the
notification routing materially change.

Production target: `https://meetdandy-lp.com` (autoscale).

## 1. How the signal is generated

Pure "no events for N hours" alerts are ambiguous in our project: silence
could mean Sentry ingestion is broken, or it could simply mean the app
had no errors in the window. To remove that ambiguity the api-server
emits a deterministic heartbeat:

- Module: `artifacts/api-server/src/lib/sentryHeartbeat.ts`
- Wired in `artifacts/api-server/src/server.ts` after `app.listen`
- Cadence: every **5 minutes** (`SENTRY_HEARTBEAT_INTERVAL_MS`)
- Payload: `Sentry.captureMessage("api-server heartbeat", { level: "info", tags: { heartbeat: "true" }, fingerprint: ["api-server-heartbeat"] })`
- Guards: only runs when `isSentryInitialized()` is true AND
  `NODE_ENV === "production"`, so dev/staging Sentry projects stay clean
- Fingerprint is stable so all heartbeats collapse into a single Sentry
  issue instead of spamming the inbox

If ingestion breaks (bad DSN, network egress block, quota exhausted),
the heartbeat events stop arriving in Sentry within minutes.

## 2. Sentry alert rule

Configured once in the Sentry UI for the api-server project. Re-create
it from these exact settings if it's ever deleted:

- **Project**: api-server (the one matching `SENTRY_DSN_BACKEND`)
- **Type**: Issue Alert (Alerts → Create Alert → Issues)
- **Environment filter**: `production`
- **When**: "The issue is older than ..." → not used. Instead use the
  built-in **"An issue's events"** condition:
  - "Number of events in an issue is less than `1` in `30 minutes`"
  - Filter: `tag:heartbeat equals true`
- **Frequency**: Perform actions at most once every `30 minutes`
- **Action**: Send a notification to **#eng-alerts** (Slack) AND email
  the on-call engineering alias

Why a 30-minute window with a 5-minute heartbeat: we tolerate up to one
missed heartbeat (autoscale cold start, brief blip) before paging, but a
real ingestion outage is detected within ~30 minutes.

If Sentry's "issue alert" plan tier doesn't allow the inverse-count
condition, the equivalent metric alert is:

- **Type**: Metric Alert → "Number of Events"
- **Filter**: `environment:production tag:heartbeat:true`
- **Trigger (critical)**: Count below `1` over a `30 minute` window
- **Resolve**: Count above `0` over a `5 minute` window

## 3. End-to-end verification

Run these checks against the live deployment after any change to the
heartbeat module, the alert rule, or the Sentry DSN/secrets.

### 3a. Heartbeat events are arriving

In Sentry → Discover (or Issues), filter:

```
environment:production tag:heartbeat:true
```

Expect: a recurring event grouped into a single issue titled
`api-server heartbeat`, with new occurrences every ~5 minutes.

### 3b. The alert is armed

In Sentry → Alerts, open the rule. Confirm:

- Status is "Active" (not muted/snoozed)
- Environment filter shows `production`
- Both action targets (Slack channel + email alias) are present and
  show no recent delivery failures

### 3c. Failure-mode dry run (optional, do during a low-traffic window)

To prove the alert actually pages, temporarily mute the heartbeat
without touching production:

1. In Sentry, snooze the heartbeat issue for 1 hour.
2. Wait until the alert window (30 min) elapses with no new events.
3. Confirm the alert fires into Slack/email.
4. Un-snooze the issue and confirm the alert auto-resolves on the next
   heartbeat.

Do **not** "verify" by disabling the prod DSN or killing the app — that
risks real outage masking.

## 4. How to re-verify

1. `await viewEnvVars({ type: "all", keys: ["SENTRY_DSN_BACKEND"] })` —
   confirm the prod DSN is still set.
2. `await getDeploymentInfo()` — confirm `hasSuccessfulBuild` so the
   heartbeat module is actually running in prod.
3. Run §3a in Sentry — confirm a heartbeat event in the last 10 minutes.
4. Run §3b in Sentry — confirm the alert rule is Active with both
   notification targets healthy.
