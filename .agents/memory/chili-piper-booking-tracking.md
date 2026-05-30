---
name: Chili Piper booking tracking
description: Where CP booking tracking lives and why it must never gate on lead PII being present in the postMessage.
---

# Chili Piper booking tracking

There are TWO render surfaces that record a CP `booking-confirmed` postMessage as a
lead (`POST /lp/leads`) + a `chilipiper_booking` conversion (`POST /lp/track`):
- Hero CTA: `BlockHero` → `CtaButton` (ctaAction="chilipiper") → `ChiliPiperButton`
  (its own `window` message listener, gated on the modal being `open`).
- cta-button block: `BlockCtaButton` (isChiliPiper) → `ChiliPiperModal` →
  `useChiliPiperBookingTracking` hook.
Any fix to booking tracking must be applied to BOTH; they are independent copies.

## Rule: never gate booking recording on lead PII

Do NOT require `email/firstName/phone` to be present before recording the booking.
The ONLY ownership guard that's safe is `if (!url) return` (the instance that owns a
scheduler URL / whose modal is open is the one that produced the booking).

**Why:** Direct-scheduler bookings (visitor types details inside the CP iframe, no
preceding lead-capture form) frequently post a `booking-confirmed` with NO lead
payload. A "prevent duplicate blank lead entries" change once added a PII-identity
gate; it silently dropped the lead AND the conversion for every PII-less booking —
i.e. real bookings stopped being tracked anywhere (revenue-impacting regression).
The original blank-duplicate rows actually came from URL-less sibling instances,
which `if (!url) return` already prevents, so the PII gate was redundant AND harmful.

**How to apply:** When touching `ChiliPiperButton.tsx` or the
`useChiliPiperBookingTracking` hook in `ChiliPiperModal.tsx`, keep the url guard,
keep `lead?.` null-safe access (lead may be null), and record regardless of PII.

## Rule: conversion track POST must omit testId/variantId when there's no A/B test

In the `chilipiper_booking` track POST, only include `testId`/`variantId` when they
are actually present in `PageContext`. Hardcoding `testId: 0` / `variantId: 0`
violates the `lp_events` FK and 500s on every plain builder page (the error is
swallowed by the surrounding catch, silently dropping the conversion from funnel
reports). Pull `testId` from `usePageContext()` and add to the effect deps.

## Test gap to watch

`chili-piper-handoff.spec.ts` mocks always sent PII → false confidence. The
PII-less regression test there exercises the modal/hook path. The hero
`ChiliPiperButton` path has no dedicated e2e test yet (structurally identical logic).
