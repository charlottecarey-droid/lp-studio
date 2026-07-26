---
name: SFDC microsite button poller
description: Design rules for the pull-model Salesforce microsite request poller (button-triggered account microsites)
---

# SFDC microsite button — pull-model poller rules

- **Claim before enqueue.** The poller PATCHes the request to Processing in Salesforce BEFORE creating the generation job. A crash can therefore never double-enqueue; crash residue (Processing without a Job_Id__c) is cleaned by the stale sweep (SystemModstamp > 2h → Failed).
  **Why:** architect ruling — enqueue-first left a window where two ticks could both start jobs for the same request.
- **Only LIVE URLs go to the Account.** The Salesforce Account URL field must never receive a draft/review-token preview link; preview URLs go only on the request record. Auto-publish is fail-closed: tenant must not require review AND strict-fact flags clean AND zero pending flags.
- **Plan gate covers manual paths too.** The scheduler checks the salesConsole plan per tenant, and the manual poll-now route must apply the same 403 gate — otherwise a downgraded tenant with the flag still enabled can run polls by hand.
- **Enable/enabled state lives in sfdc_connections.metadata** (readMicrositeButtonState / writeMicrositeButtonState), not a new table; eligibility = connected connection + active tenant + non-null tenantId + enabled flag + plan.
- **How to apply:** any new trigger surface (webhook, second button, bulk action) must reuse the same claim-first + LIVE-only + plan-gated pattern and record the trigger as a sales signal (type `microsite_requested`).

# Choice object record Name must be Text + label-filled

- Screen Flow record choice sets display record **Name** by default. Any
  lookup/choice object provisioned with an AutoNumber name makes every admin
  flow show "R-00010"-style values (user-reported on the choice object).
- **Rule:** objects whose rows are picked by humans get a Text nameField and
  the sync writes `Name = label` (cap 80 chars — Salesforce Text Name limit);
  only queue-style objects (the request object) keep AutoNumber.
- Existing orgs convert in-place via SOAP `updateMetadata` (same CustomObject
  XML as create); provision detects a legacy AutoNumber Name via describe
  (`fields[Name].autoNumber`) — idempotent, failures degrade to status manual.
- Sync guards Name writes on describe (`autoNumber !== true && createable`) so
  an unconverted org never gets a rejected write. Once converted, Name is
  REQUIRED on create — prod must run the new sync code (republish) or new
  choice rows fail with REQUIRED_FIELD_MISSING.

# Provisioning: Tooling API cannot create custom OBJECTS

- The Tooling REST API's CustomObject describe reports `createable: false`
  (only CustomField is createable there). POSTing FullName/Metadata to
  `/tooling/sobjects/CustomObject` fails with INVALID_FIELD
  "No such column 'FullName'" — on every org/API version tried, not an org quirk.
- **Fix pattern:** create objects via the SOAP Metadata API `createMetadata`
  call (`POST {instance}/services/Soap/m/{ver}` with the OAuth access token as
  `<sessionId>`); keep custom FIELDS on the Tooling REST path (works fine).
  Element order inside `<metadata>` must follow the WSDL sequence
  (fullName → deploymentStatus → label → nameField → pluralLabel → sharingModel).
- Failure shape: SOAP returns HTTP 200 with `<success>false</success>` +
  `<statusCode>`/`<message>` — parse these into the thrown error so
  DUPLICATE_DEVELOPER_NAME idempotency matching keeps working.
- Web search / docs claim the tooling POST works — trust the org's own
  `/describe` (`createable` flag) over blog posts.
