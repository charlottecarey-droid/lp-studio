---
name: Signup email-verify auto-login hijack class
description: Why GET /verify auto-login makes unverified-account password handling a symmetric-vulnerable pre-hijack surface, and what the real fix is.
---

# Signup email-verify auto-login hijack class

`GET /api/auth/email/verify` (auth.ts) does two things at once: it marks
`email_verified=true` AND establishes a session (auto-login via
`establishSession`). Because the confirmation link always goes to the email
address itself, **whoever clicks a confirmation link is logged into the
account with whatever `password_hash` currently sits on the (unverified) row.**

## The trap
The register ON CONFLICT branch re-sends the confirmation for an unverified
password account. Two password-handling choices, BOTH vulnerable, symmetric:
- **Keep the stored password (current behavior):** exploitable when an
  attacker *pre-registers* a victim's email first — victim later clicks and
  ends up logged in on an account whose password is the attacker's.
- **Overwrite to the newest registration's password:** exploitable in the
  mirror direction — an attacker who *races an in-progress* legitimate signup
  overwrites the pending password, and the victim clicks the newest link into
  an account with the attacker's password.

So the architect's "overwrite on re-send" suggestion does not close the hole;
it just moves it. We deliberately keep the stored password and do NOT
overwrite.

**Why:** neither keep nor overwrite is strictly safer; picking either without
addressing the root cause trades one hijack ordering for another.

**How to apply:** the *complete* fix is to stop auto-logging-in on verify
(verify should only prove ownership; require an explicit login afterward), OR
bind the password to the specific verification token (pending-registration
record / token carries the password_hash it was minted with) so clicking
link-N sets password-N. Treat any change to register/verify password handling
as this class of problem, not a one-line tweak. The "row created before send"
design is fine on its own — unverified rows can't log in — this is purely the
verify-auto-login coupling.
