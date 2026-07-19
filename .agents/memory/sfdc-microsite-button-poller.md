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
