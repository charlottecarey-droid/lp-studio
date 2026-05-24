import { useState, type FormEvent } from "react";
import type { IdFormBlockProps, IdFormField } from "@/lib/block-types";

interface Props {
  props: IdFormBlockProps;
}

const HEAD = `var(--brand-font-body, var(--app-font-sans, system-ui)), 'Inter', system-ui, sans-serif`;
const SERIF = `var(--brand-font-display, var(--app-font-display, 'Bagoss Standard')), 'Bagoss Standard', 'Inter', Georgia, serif`;
const MONO = `"JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace`;

const DEFAULTS = {
  background: "#001814",
  surface: "rgba(255,255,255,0.03)",
  border: "rgba(199,231,56,0.18)",
  headlineColor: "#ffffff",
  subheadlineColor: "rgba(255,255,255,0.65)",
  labelColor: "rgba(255,255,255,0.55)",
  inputBg: "rgba(255,255,255,0.02)",
  inputBorder: "rgba(255,255,255,0.12)",
  inputText: "#ffffff",
  buttonBg: "#C7E738",
  buttonText: "#001814",
  accent: "#C7E738",
};

function sanitizeName(id: string) {
  return (id || "field").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
}

export function BlockIdForm({ props }: Props) {
  const fields = props.fields ?? [];
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const bg = props.backgroundColor || DEFAULTS.background;
  const surface = props.surfaceColor || DEFAULTS.surface;
  const border = props.borderColor || DEFAULTS.border;
  const headlineColor = props.headlineColor || DEFAULTS.headlineColor;
  const subheadlineColor = props.subheadlineColor || DEFAULTS.subheadlineColor;
  const labelColor = props.labelColor || DEFAULTS.labelColor;
  const inputBg = props.inputBg || DEFAULTS.inputBg;
  const inputBorder = props.inputBorder || DEFAULTS.inputBorder;
  const inputText = props.inputText || DEFAULTS.inputText;
  const buttonBg = props.buttonBg || DEFAULTS.buttonBg;
  const buttonText = props.buttonText || DEFAULTS.buttonText;
  const accent = props.accent || DEFAULTS.accent;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "submitting") return;
    setError(null);
    setStatus("submitting");

    const data: Record<string, string> = {};
    new FormData(e.currentTarget).forEach((v, k) => {
      data[k] = typeof v === "string" ? v : "";
    });

    try {
      if (props.submitUrl) {
        const res = await fetch(props.submitUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setStatus("error");
    }
  };

  return (
    <section
      className="id-block id-form-block"
      style={{
        background: bg,
        color: headlineColor,
        padding: "clamp(96px, 10vw, 140px) clamp(24px, 4vw, 56px)",
        fontFamily: HEAD,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <FormStyles accent={accent} />
      <div
        className="id-form-block__inner"
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1.1fr",
          gap: "clamp(40px, 6vw, 96px)",
          alignItems: "start",
        }}
      >
        {/* LEFT: copy */}
        <div className="id-form-block__copy">
          {props.eyebrow && (
            <div
              className="id-form-block__eyebrow"
              style={{ fontFamily: MONO, color: accent }}
            >
              <span className="id-form-block__eyebrow-dot" style={{ background: accent }} />
              <span dangerouslySetInnerHTML={{ __html: props.eyebrow }} />
            </div>
          )}
          {props.headline && (
            <h2
              className="id-form-block__headline"
              style={{ fontFamily: SERIF, color: headlineColor }}
              dangerouslySetInnerHTML={{ __html: props.headline }}
            />
          )}
          {props.subheadline && (
            <p
              className="id-form-block__sub"
              style={{ color: subheadlineColor }}
              dangerouslySetInnerHTML={{ __html: props.subheadline }}
            />
          )}
          {props.metaItems && props.metaItems.length > 0 && (
            <ul className="id-form-block__meta">
              {props.metaItems.map((m, i) => (
                <li key={i} style={{ borderColor: border }}>
                  <span style={{ fontFamily: MONO, color: labelColor }}>{m.label}</span>
                  <span
                    style={{ fontFamily: SERIF, color: headlineColor }}
                    dangerouslySetInnerHTML={{ __html: m.value }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* RIGHT: form */}
        <div
          className="id-form-block__card"
          style={{
            background: surface,
            border: `1px solid ${border}`,
            borderRadius: 16,
            padding: "clamp(28px, 3vw, 44px)",
            backdropFilter: "blur(12px)",
          }}
        >
          {status === "success" ? (
            <div className="id-form-block__success" style={{ color: headlineColor }}>
              <div className="id-form-block__success-mark" style={{ borderColor: accent, color: accent }}>✓</div>
              <h3 style={{ fontFamily: SERIF, color: headlineColor }}>
                {props.successHeadline || "Thanks — we'll be in touch."}
              </h3>
              {props.successBody && (
                <p style={{ color: subheadlineColor }} dangerouslySetInnerHTML={{ __html: props.successBody }} />
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="id-form-block__fields">
                {fields.map((f, i) => (
                  <FieldInput
                    key={`${f.name || "f"}-${i}`}
                    field={f}
                    labelColor={labelColor}
                    inputBg={inputBg}
                    inputBorder={inputBorder}
                    inputText={inputText}
                    accent={accent}
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="id-form-block__submit"
                style={{
                  background: buttonBg,
                  color: buttonText,
                  fontFamily: HEAD,
                }}
              >
                {status === "submitting"
                  ? props.submittingText || "Sending…"
                  : props.submitText || "Submit"}
                <span aria-hidden> →</span>
              </button>
              {props.legal && (
                <p
                  className="id-form-block__legal"
                  style={{ color: labelColor, fontFamily: MONO }}
                  dangerouslySetInnerHTML={{ __html: props.legal }}
                />
              )}
              {status === "error" && (
                <p className="id-form-block__error" role="alert">
                  {error || "Something went wrong. Please try again."}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

interface FieldInputProps {
  field: IdFormField;
  labelColor: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  accent: string;
}

function FieldInput({ field, labelColor, inputBg, inputBorder, inputText, accent }: FieldInputProps) {
  const name = sanitizeName(field.name);
  const id = `id-form-${name}`;
  const type = field.type || "text";
  const span = field.fullWidth ? "1 / -1" : undefined;
  const sharedStyle = {
    background: inputBg,
    border: `1px solid ${inputBorder}`,
    color: inputText,
    fontFamily: HEAD,
  };

  let control: React.ReactNode;
  if (type === "textarea") {
    control = (
      <textarea
        id={id}
        name={name}
        required={field.required}
        placeholder={field.placeholder || ""}
        rows={field.rows || 4}
        className="id-form-block__input id-form-block__textarea"
        style={{ ...sharedStyle, ["--id-form-accent" as never]: accent }}
      />
    );
  } else if (type === "select") {
    control = (
      <select
        id={id}
        name={name}
        required={field.required}
        defaultValue=""
        className="id-form-block__input id-form-block__select"
        style={{ ...sharedStyle, ["--id-form-accent" as never]: accent }}
      >
        <option value="" disabled>
          {field.placeholder || "Select…"}
        </option>
        {(field.options || []).map((o, i) => (
          <option key={i} value={o.value || o.label}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        id={id}
        name={name}
        type={type}
        required={field.required}
        placeholder={field.placeholder || ""}
        className="id-form-block__input"
        style={{ ...sharedStyle, ["--id-form-accent" as never]: accent }}
      />
    );
  }

  return (
    <div className="id-form-block__field" style={{ gridColumn: span }}>
      <label htmlFor={id} style={{ color: labelColor, fontFamily: MONO }}>
        {field.label}
        {field.required && <span aria-hidden style={{ color: accent, marginLeft: 4 }}>*</span>}
      </label>
      {control}
    </div>
  );
}

function FormStyles({ accent }: { accent: string }) {
  return (
    <style>{`
      .id-form-block { box-sizing: border-box; }
      .id-form-block *, .id-form-block *::before, .id-form-block *::after { box-sizing: border-box; }
      .id-form-block::before { content:""; position:absolute; inset:0; background:radial-gradient(ellipse 1200px 600px at 50% -10%, ${hexToRgba(accent, 0.06)}, transparent 60%); pointer-events:none; }
      .id-form-block > * { position: relative; }

      .id-form-block__eyebrow { display:inline-flex; align-items:center; gap:12px; font-size:11px; letter-spacing:0.24em; text-transform:uppercase; margin-bottom:32px; }
      .id-form-block__eyebrow-dot { width:6px; height:6px; border-radius:50%; box-shadow:0 0 10px ${hexToRgba(accent, 0.7)}; }
      .id-form-block__headline { font-weight:300; font-size:clamp(36px, 4.4vw, 64px); line-height:1.04; letter-spacing:-0.022em; margin:0 0 24px; max-width:18ch; }
      .id-form-block__headline em { font-style:italic; color:${accent}; font-weight:300; }
      .id-form-block__sub { font-size:clamp(15px, 1.2vw, 17px); line-height:1.55; font-weight:350; max-width:48ch; margin:0; }
      .id-form-block__sub em { font-style:italic; color:${accent}; }

      .id-form-block__meta { list-style:none; padding:0; margin:40px 0 0; display:grid; gap:16px; }
      .id-form-block__meta li { display:grid; grid-template-columns:140px 1fr; gap:24px; padding:16px 0; border-top:1px solid; align-items:baseline; }
      .id-form-block__meta li > span:first-child { font-size:10px; letter-spacing:0.28em; text-transform:uppercase; }
      .id-form-block__meta li > span:last-child { font-size:18px; font-weight:300; letter-spacing:-0.01em; }
      .id-form-block__meta li > span:last-child em { font-style:italic; color:${accent}; }

      .id-form-block__card { position:relative; }

      .id-form-block__fields { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:28px; }
      .id-form-block__field { display:flex; flex-direction:column; gap:8px; }
      .id-form-block__field label { font-size:10px; letter-spacing:0.24em; text-transform:uppercase; font-weight:500; }
      .id-form-block__input { width:100%; padding:14px 16px; border-radius:8px; font-size:14.5px; line-height:1.4; outline:none; transition:border-color 200ms ease, box-shadow 200ms ease, background 200ms ease; appearance:none; }
      .id-form-block__input::placeholder { color:rgba(255,255,255,0.32); }
      .id-form-block__input:focus { border-color:var(--id-form-accent, ${accent}); box-shadow:0 0 0 3px ${hexToRgba(accent, 0.12)}; }
      .id-form-block__textarea { resize:vertical; min-height:120px; font-family:inherit; }
      .id-form-block__select { cursor:pointer; background-image:linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%); background-position:calc(100% - 18px) 50%, calc(100% - 12px) 50%; background-size:6px 6px; background-repeat:no-repeat; padding-right:40px; }
      .id-form-block__select option { background:#001814; color:#fff; }

      .id-form-block__submit { display:inline-flex; align-items:center; gap:8px; padding:16px 28px; border:0; border-radius:999px; font-size:13px; font-weight:500; letter-spacing:0.02em; cursor:pointer; transition:transform 200ms ease, box-shadow 200ms ease, gap 200ms ease; box-shadow:0 8px 24px ${hexToRgba(accent, 0.2)}; }
      .id-form-block__submit:hover:not(:disabled) { transform:translateY(-1px); gap:12px; box-shadow:0 12px 32px ${hexToRgba(accent, 0.32)}; }
      .id-form-block__submit:disabled { opacity:0.6; cursor:wait; }

      .id-form-block__legal { margin:20px 0 0; font-size:10.5px; letter-spacing:0.08em; line-height:1.5; }
      .id-form-block__legal a { color:${accent}; text-decoration:underline; text-underline-offset:2px; }
      .id-form-block__error { margin:16px 0 0; font-size:13px; color:#ff8a8a; }

      .id-form-block__success { text-align:center; padding:32px 8px; }
      .id-form-block__success-mark { width:56px; height:56px; border-radius:50%; border:1.5px solid; display:inline-flex; align-items:center; justify-content:center; font-size:24px; margin-bottom:20px; box-shadow:0 0 32px ${hexToRgba(accent, 0.32)}; }
      .id-form-block__success h3 { font-weight:300; font-size:clamp(22px, 2vw, 28px); line-height:1.15; letter-spacing:-0.015em; margin:0 0 12px; }
      .id-form-block__success p { font-size:14.5px; line-height:1.55; margin:0; }

      @media (max-width: 960px) {
        .id-form-block__inner { grid-template-columns: 1fr !important; }
        .id-form-block__fields { grid-template-columns: 1fr; }
        .id-form-block__meta li { grid-template-columns: 1fr; gap:6px; }
      }
    `}</style>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  if (h.length !== 3 && h.length !== 6) return `rgba(199,231,56,${alpha})`;
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(f.slice(0, 2), 16);
  const g = parseInt(f.slice(2, 4), 16);
  const b = parseInt(f.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
