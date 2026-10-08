import { useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { usePageMeta } from "../hooks/usePageMeta";

/**
 * Public SMS opt-in / messaging-program disclosure page — lpstudio.ai/sms-opt-in.
 *
 * Exists to satisfy carrier + Twilio (toll-free / A2P) verification, which
 * requires a publicly reachable URL that shows HOW a person consents to receive
 * texts from us and the program disclosures (frequency, cost, STOP, HELP,
 * privacy). LP Studio's only SMS program is the one-time account-verification
 * code sent during self-serve sign-up (components/auth/PhoneVerify.tsx →
 * POST /api/auth/phone/send-code → Twilio Verify). The real collection point
 * sits behind email sign-in inside app.lpstudio.ai, so this page mirrors that
 * form and its consent language verbatim-in-spirit and is where reviewers are
 * pointed. Keep the disclosure text here, in PhoneVerify.tsx, and in the
 * privacy policy's SMS section in agreement when any of them changes.
 *
 * The demo form never transmits the number anywhere: submitting it sends the
 * visitor to the real sign-up flow, where the number is entered again and
 * verified. No phone data is placed in the URL.
 */

const SIGNUP_URL = "https://app.lpstudio.ai";

const CONSENT_COPY =
  "I agree to receive a one-time account verification code by SMS from LP Studio at the mobile number I provide. " +
  "One message per verification request; LP Studio does not send marketing texts. " +
  "Message and data rates may apply. Reply STOP to opt out and HELP for help. " +
  "Consent is not a condition of purchase.";

export default function SmsOptIn() {
  usePageMeta({
    title: "SMS Opt-In & Messaging Terms — LP Studio",
    description:
      "How LP Studio collects consent for SMS verification codes, what we send, how often, what it costs, and how to opt out (STOP) or get help (HELP).",
    canonical: "https://lpstudio.ai/sms-opt-in",
    ogImage: "https://lpstudio.ai/opengraph.jpg",
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageType: "image/jpeg",
    ogImageAlt: "LP Studio SMS opt-in and messaging terms",
    siteName: "LP Studio",
  });

  return (
    <div className="min-h-screen paper-grain" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-36 pb-24">
        <div className="mb-14">
          <div className="marker marker-rule mb-6">Messaging</div>
          <h1
            className="font-display"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(40px, 5.5vw, 64px)",
              lineHeight: 1.02,
              fontWeight: 600,
              letterSpacing: "-0.028em",
              marginBottom: 12,
            }}
          >
            SMS opt-in &amp; messaging terms
          </h1>
          <p
            className="font-mono uppercase"
            style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.14em" }}
          >
            Last updated: October 2026
          </p>
        </div>

        <div className="space-y-9 text-[15px] leading-[1.7]" style={{ color: "var(--ink-2)" }}>
          <Section title="What we text, and when">
            <p>
              LP Studio sends exactly one kind of text message: a <strong style={{ color: "var(--ink)" }}>one-time
              verification code</strong> that confirms you control the mobile number you enter while creating a
              workspace. We send it only after you type your number into the sign-up form and ask us to. We do not
              send marketing, promotional, or recurring messages by SMS.
            </p>
          </Section>

          <Section title="How you opt in">
            <p className="mb-5">
              Consent is collected on the phone-verification step of sign-up at app.lpstudio.ai. The form below is the
              same step, with the same consent language. Submitting it here does not send a text or store your number;
              it takes you to the sign-up flow, where you enter and verify your number.
            </p>
            <OptInForm />
          </Section>

          <Section title="Program details">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-[180px_1fr]">
              <Term>Program name</Term>
              <Def>LP Studio account verification</Def>
              <Term>Message type</Term>
              <Def>One-time passcode (OTP) for identity verification</Def>
              <Term>Sample message</Term>
              <Def>
                <code
                  className="font-mono text-[13px] px-2 py-1 rounded"
                  style={{ background: "var(--cream-2)", color: "var(--ink)" }}
                >
                  Your LP Studio verification code is: 482913
                </code>
              </Def>
              <Term>Frequency</Term>
              <Def>One message per verification request. Not recurring.</Def>
              <Term>Cost</Term>
              <Def>LP Studio does not charge for texts. Message and data rates from your carrier may apply.</Def>
              <Term>Opt out</Term>
              <Def>
                Reply <strong style={{ color: "var(--ink)" }}>STOP</strong> to any message to stop receiving texts
                from LP Studio. Because codes are sent only when you request one, you can also opt out simply by not
                requesting a code. After replying STOP you will not be able to complete phone verification until you
                opt back in by replying <strong style={{ color: "var(--ink)" }}>START</strong>.
              </Def>
              <Term>Help</Term>
              <Def>
                Reply <strong style={{ color: "var(--ink)" }}>HELP</strong> to any message, or email{" "}
                <LegalLink href="mailto:admin@lpstudio.ai">admin@lpstudio.ai</LegalLink>.
              </Def>
              <Term>Carriers</Term>
              <Def>Carriers are not liable for delayed or undelivered messages.</Def>
            </dl>
          </Section>

          <Section title="Privacy">
            <p>
              Your mobile number is used only to deliver the verification code and to enforce our one-free-trial-per-person
              policy, for which we store a salted hash of the number rather than the number itself.
            </p>
            <p className="mt-3">
              <strong style={{ color: "var(--ink)" }}>
                No mobile information will be shared with third parties or affiliates for marketing or promotional
                purposes.
              </strong>{" "}
              Text messaging originator opt-in data and consent are not shared with any third parties, except for the
              messaging provider that delivers the code on our behalf. See our{" "}
              <LegalLink href="/privacy">Privacy Policy</LegalLink> and{" "}
              <LegalLink href="/terms">Terms of Service</LegalLink>.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about SMS messaging from LP Studio? Email{" "}
              <LegalLink href="mailto:admin@lpstudio.ai">admin@lpstudio.ai</LegalLink>.
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/**
 * Mirror of the sign-up phone-verification step. The number typed here is
 * never transmitted or persisted: submit navigates to the real sign-up flow.
 */
function OptInForm() {
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const canContinue = phone.trim().length > 0 && agreed;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canContinue) return;
    // Deliberately no phone in the URL — the sign-up flow collects it again.
    window.location.assign(SIGNUP_URL);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl p-6 sm:p-8 space-y-5"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        boxShadow: "0 1px 2px rgba(26, 24, 21, 0.06), 0 12px 32px -20px rgba(26, 24, 21, 0.25)",
      }}
      aria-labelledby="sms-opt-in-heading"
    >
      <div>
        <h3
          id="sms-opt-in-heading"
          className="font-display"
          style={{ color: "var(--ink)", fontSize: 20, fontWeight: 600, letterSpacing: "-0.015em" }}
        >
          Verify your phone
        </h3>
        <p className="mt-1 text-[14px]" style={{ color: "var(--ink-mute)" }}>
          We'll text a code to confirm you're a real person before starting your free trial.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="sms-opt-in-phone" className="block text-[13px] font-medium" style={{ color: "var(--ink)" }}>
          Mobile number
        </label>
        <input
          id="sms-opt-in-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+1 555 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-3.5 py-2.5 text-[15px] rounded-lg outline-none transition-shadow focus:ring-2"
          style={{
            background: "var(--cream)",
            border: "1px solid var(--hairline)",
            color: "var(--ink)",
          }}
        />
        <p className="text-[12px]" style={{ color: "var(--ink-mute)" }}>
          Include your country code. VOIP and landline numbers aren't accepted.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-[3px] h-4 w-4 shrink-0 rounded"
          style={{ accentColor: "var(--indigo-accent)" }}
          required
        />
        <span className="text-[13px] leading-[1.6]" style={{ color: "var(--ink-2)" }}>
          {CONSENT_COPY} See our <LegalLink href="/privacy">Privacy Policy</LegalLink> and{" "}
          <LegalLink href="/terms">Terms of Service</LegalLink>.
        </span>
      </label>

      <button
        type="submit"
        disabled={!canContinue}
        className="w-full px-4 py-2.5 text-[14px] font-medium transition-all inline-flex items-center justify-center gap-1.5 disabled:cursor-not-allowed"
        style={{
          background: "var(--navy)",
          color: "var(--cream)",
          borderRadius: 8,
          opacity: canContinue ? 1 : 0.45,
          boxShadow: "0 1px 2px rgba(26, 24, 21, 0.10), 0 4px 12px -6px rgba(26, 24, 21, 0.25)",
        }}
      >
        Continue to sign up
      </button>

      <p className="text-[12px] text-center" style={{ color: "var(--ink-mute)" }}>
        The code is sent from inside the sign-up flow, after you enter your number there.
      </p>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="font-display mb-3"
        style={{
          color: "var(--ink)",
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "-0.015em",
          lineHeight: 1.25,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Term({ children }: { children: React.ReactNode }) {
  return (
    <dt
      className="font-mono uppercase pt-[3px]"
      style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.14em" }}
    >
      {children}
    </dt>
  );
}

function Def({ children }: { children: React.ReactNode }) {
  return <dd className="m-0">{children}</dd>;
}

function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="underline underline-offset-4 transition-colors"
      style={{ color: "var(--indigo-accent)", textDecorationColor: "rgba(75, 71, 229, 0.4)" }}
    >
      {children}
    </a>
  );
}
