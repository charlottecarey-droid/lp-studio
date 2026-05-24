import { BlockIdForm } from "../../../../../lp-studio/src/blocks/BlockIdForm";

export default function Preview() {
  return (
    <BlockIdForm
      props={{
        eyebrow: "GET IN TOUCH",
        headline: "Let's see if Dandy <em>fits your lab</em>.",
        subheadline:
          "Tell us a little about your practice — a member of our team will reach out within one business day.",
        metaItems: [
          { label: "RESPONSE TIME", value: "Under <em>1 business day</em>" },
          { label: "LOCATIONS", value: "Provo · NYC · Remote" },
        ],
        fields: [
          { name: "first-name", label: "First name", type: "text", required: true, placeholder: "Jane" },
          { name: "last-name", label: "Last name", type: "text", required: true, placeholder: "Doe" },
          { name: "email", label: "Work email", type: "email", required: true, placeholder: "jane@practice.com", fullWidth: true },
          { name: "practice", label: "Practice or organization", type: "text", placeholder: "Smile Dental", fullWidth: true },
          { name: "role", label: "Role", type: "select", placeholder: "Select your role", options: [
            { label: "Dentist", value: "dentist" },
            { label: "Office Manager", value: "office-manager" },
            { label: "DSO Leader", value: "dso-leader" },
            { label: "Other", value: "other" },
          ] },
          { name: "monthly-cases", label: "Monthly cases", type: "select", placeholder: "Estimate", options: [
            { label: "Under 25", value: "<25" },
            { label: "25 – 100", value: "25-100" },
            { label: "100 – 500", value: "100-500" },
            { label: "500+", value: "500+" },
          ] },
          { name: "message", label: "What are you trying to solve?", type: "textarea", placeholder: "A few sentences is plenty.", fullWidth: true, rows: 4 },
        ],
        submitText: "Request a conversation",
        submittingText: "Sending…",
        successHeadline: "Thanks — we'll be in touch.",
        successBody: "A member of our team will reach out within one business day.",
        legal: 'By submitting, you agree to our <a href="#">privacy policy</a>.',
      }}
    />
  );
}
