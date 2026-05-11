# Sentry production alerts — verification (tasks #190, #194)

This doc covers two complementary production alerts:

1. **Heartbeat / "no events" alert** (task #190) — pages when the
   api-server stops sending events to Sentry at all (silent failure).
2. **Error spike alert** (task #194) — pages when production error
   volume suddenly jumps, catching deployment regressions and
   dependency outages within minutes instead of waiting for a
   customer to complain.

Both alerts route to the same #eng-alerts Slack channel and on-call
email alias.

---

# Part 1: "no events" alert — production verification (task #190)

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

---

# Part 2: error spike alert — production verification (task #194)

The heartbeat alert above only catches the silent-failure case. The
opposite failure mode — a deploy regression, a runaway loop, or an
upstream dependency outage that suddenly produces a flood of errors —
needs its own alarm so on-call hears about it within minutes.

## 1. How the signal is generated

No new application code is required. The signal is just the normal
error events that `Sentry.init(...)` in
`artifacts/api-server/src/lib/sentry.ts` already sends from the
`production` environment. The heartbeat events emitted by
`sentryHeartbeat.ts` are tagged `heartbeat:true` at `level:info`, so
filtering on `level:error` (or excluding `tag:heartbeat:true`)
cleanly separates real errors from heartbeat noise.

## 2. Sentry alert rule

Configured once in the Sentry UI for the api-server project. Re-create
it from these exact settings if it's ever deleted:

- **Project**: api-server (the one matching `SENTRY_DSN_BACKEND`)
- **Type**: Metric Alert → "Number of Events"
- **Filter**: `environment:production !tag:heartbeat:true level:error`
- **Time window**: `5 minutes`
- **Trigger (critical)**: Count above `20` over the 5-minute window
- **Trigger (warning, optional)**: Count above `5` over the 5-minute
  window — useful for early Slack-only signal without paging
- **Resolve**: Count at or below `5` over a `10 minute` window (so a
  brief lull doesn't flap the alert closed mid-incident)
- **Frequency**: Perform actions at most once every `5 minutes`
- **Action (critical)**: Send a notification to **#eng-alerts**
  (Slack) AND email the on-call engineering alias — same routing as
  the Part 1 heartbeat alert
- **Action (warning, optional)**: Slack **#eng-alerts** only

### Why these thresholds

- **20 errors / 5 min critical**: in steady state the api-server
  produces well under this volume, so 20 in 5 minutes is a clear
  signal that something deployed or upstream just broke. Low enough
  to fire within minutes of a regression, high enough to not page on
  a single user's bad request burst.
- **5 minute window**: matches the heartbeat cadence and gives the
  alert enough samples to avoid single-event noise while still
  paging fast.
- **`!tag:heartbeat:true`**: the heartbeat issue is `level:info`, but
  the explicit exclusion is belt-and-suspenders in case the
  heartbeat level ever changes.
- **Resolve at ≤5 over 10 min**: longer resolve window than trigger
  window prevents the alert from oscillating during an ongoing
  incident with intermittent error bursts.

If the Sentry plan tier doesn't expose Metric Alerts, the
equivalent Issue Alert is:

- **Type**: Issue Alert
- **When**: "An event is seen" with condition "The issue is seen
  more than `20` times in `5 minutes`"
- **Filters**: `environment equals production`,
  `tag:heartbeat does not equal true`, `level equals error`
- **Frequency**: at most once every `5 minutes`
- **Action**: same Slack + email as above

## 3. End-to-end verification

Run these checks against the live deployment after any change to
the alert rule, the Sentry DSN/secrets, or the heartbeat tagging.

### 3a. Baseline error volume is below threshold

In Sentry → Discover, run:

```
environment:production !tag:heartbeat:true level:error
```

over the last 24 hours grouped by 5-minute buckets. Expect the vast
majority of buckets to be well under 20. If steady-state volume is
already near 20, raise the threshold rather than living with a noisy
alert.

### 3b. The alert is armed

In Sentry → Alerts, open the rule. Confirm:

- Status is "Active" (not muted/snoozed)
- Filter shows `environment:production !tag:heartbeat:true level:error`
- Critical trigger is `> 20` over `5 minutes`
- Both action targets (Slack channel + email alias) are present and
  show no recent delivery failures — these must match the Part 1
  heartbeat alert routing exactly

### 3c. Failure-mode dry run (optional, do during a low-traffic window)

To prove the alert actually pages without breaking prod:

1. Temporarily lower the critical threshold to `1` event over
   `1 minute` in the Sentry UI.
2. From a maintenance shell, trigger a single handled error in
   production (e.g. hit an endpoint that calls
   `Sentry.captureException(new Error("alert dry-run task #194"))`
   behind an admin-only flag).
3. Confirm the alert fires into Slack and email within a few minutes.
4. Restore the threshold to `> 20 / 5 min` and confirm the alert
   auto-resolves.

Do **not** "verify" by pushing a real broken deploy or by disabling
the prod DSN — both risk masking a real outage.

## 4. How to re-verify

1. `await viewEnvVars({ type: "all", keys: ["SENTRY_DSN_BACKEND"] })` —
   confirm the prod DSN is still set.
2. `await getDeploymentInfo()` — confirm `hasSuccessfulBuild` so the
   api-server is actually emitting events in prod.
3. Run §3a in Sentry — confirm baseline error volume is comfortably
   below the threshold.
4. Run §3b in Sentry — confirm the alert rule is Active with both
   notification targets healthy and matching the heartbeat alert.
