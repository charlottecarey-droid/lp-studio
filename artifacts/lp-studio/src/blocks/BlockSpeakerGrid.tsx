import type { BrandConfig } from "@/lib/brand-config";
import type { SpeakerGridBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";

interface Props {
  props: SpeakerGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: SpeakerGridBlockProps) => void;
}

const COL_CLASSES: Record<NonNullable<SpeakerGridBlockProps["columns"]>, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
};

export function BlockSpeakerGrid({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#0A0A0B";
  const text = props.textColor ?? "#F5F5F7";
  const accent = props.accentColor ?? brand.primaryColor ?? "#7B5BFF";
  const cols = props.columns ?? 3;

  const updateField = <K extends keyof SpeakerGridBlockProps>(
    key: K,
    value: SpeakerGridBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateSpeaker = (i: number, patch: Partial<SpeakerGridBlockProps["speakers"][number]>) => {
    if (!onFieldChange) return;
    const next = props.speakers.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onFieldChange({ ...props, speakers: next });
  };

  return (
    <section className="px-6 py-20 sm:py-28" style={{ backgroundColor: bg, color: text }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="p"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v: string) => updateField("eyebrow", v) : undefined}
              className="text-xs uppercase tracking-[0.3em] mb-3"
              style={{ color: accent }}
            />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v: string) => updateField("headline", v) : undefined}
            className="text-4xl sm:text-5xl font-semibold tracking-tight"
          />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v: string) => updateField("subheadline", v) : undefined}
              className="mt-3 opacity-70 max-w-2xl mx-auto"
            />
          )}
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${COL_CLASSES[cols]} gap-8`}>
          {props.speakers.map((sp, i) => (
            <div key={i} className="group">
              <div className="aspect-square overflow-hidden rounded-2xl mb-4"
                   style={{ backgroundColor: `${text}10` }}>
                <InlineImage
                  src={sp.photoUrl}
                  alt={sp.name}
                  onUpdate={onFieldChange ? (src: string) => updateSpeaker(i, { photoUrl: src }) : undefined}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <h3 className="text-lg font-semibold leading-tight">{sp.name}</h3>
              <p className="text-sm mt-1" style={{ color: accent }}>{sp.role}</p>
              {sp.company && <p className="text-sm opacity-70">{sp.company}</p>}
              {sp.bio && <p className="text-sm opacity-75 mt-2 leading-relaxed">{sp.bio}</p>}
              {sp.socialUrl && (
                <a
                  href={sp.socialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-xs uppercase tracking-wider underline opacity-80 hover:opacity-100"
                >
                  {sp.socialLabel ?? "Connect"}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
