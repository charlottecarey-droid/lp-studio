import { useState, type FormEvent, type CSSProperties } from "react";

interface Props {
  email: string;
  onEmailChange: (email: string) => void;
  onSubmit: (email: string) => void;
  placeholder?: string;
  buttonText: string;
  /** Pill background. Defaults to white. */
  pillBg?: string;
  /** Submit button background. */
  buttonBg?: string;
  /** Submit button text color. */
  buttonColor?: string;
  /** Pill text/input color. */
  inputColor?: string;
  /** Border color of the pill. */
  pillBorder?: string;
  /** Maximum width. */
  maxWidth?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Inline pill-shaped email capture used by hero / scroll blocks.
 * Mirrors the visual + interaction pattern from BlockDandyProductHero so
 * email values flow through to the global EmailCaptureModal in a uniform
 * way across the product.
 */
export function InlineEmailCapture({
  email,
  onEmailChange,
  onSubmit,
  placeholder = "Email address",
  buttonText,
  pillBg = "#ffffff",
  buttonBg = "var(--brand-accent, #C7E738)",
  buttonColor = "var(--brand-primary, #003a30)",
  inputColor = "#0f172a",
  pillBorder = "rgba(0,0,0,0.08)",
  maxWidth = "440px",
  className,
  style,
}: Props) {
  const [touched, setTouched] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    // Always invoke onSubmit — modal flows want to open even with empty email
    // (the modal will require it). But basic browser validation also runs via
    // the `required` attribute when the form would actually navigate.
    onSubmit(email);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={className}
      style={{
        width: "100%",
        maxWidth,
        display: "flex",
        alignItems: "stretch",
        background: pillBg,
        borderRadius: "9999px",
        padding: "6px",
        boxShadow: "0 18px 40px -16px rgba(0,0,0,0.35)",
        border: `1px solid ${pillBorder}`,
        ...style,
      }}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        aria-label={placeholder}
        required
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: "none",
          outline: "none",
          padding: "0 14px 0 18px",
          fontSize: "0.95rem",
          color: inputColor,
        }}
      />
      <button
        type="submit"
        style={{
          background: buttonBg,
          color: buttonColor,
          border: "none",
          borderRadius: "9999px",
          padding: "10px 22px",
          fontWeight: 700,
          fontSize: "0.9rem",
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "filter 120ms ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.06)")}
        onMouseLeave={(e) => (e.currentTarget.style.filter = "")}
      >
        {buttonText}
      </button>
      {touched && email && !/^\S+@\S+\.\S+$/.test(email) && (
        <span className="sr-only">Invalid email</span>
      )}
    </form>
  );
}
