import type {
  GridImageBlockProps,
  GridHeadlineSubBlockProps,
  GridParagraphBulletsBlockProps,
  GridHeadlineParagraphBlockProps,
  GridIconFeatureBlockProps,
  GridStatBlockProps,
  GridQuoteBlockProps,
  GridCtaTileBlockProps,
  GridLogoBlockProps,
  GridVideoBlockProps,
} from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

const ALIGN_CLASS: Record<"left" | "center" | "right", string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function BlockGridImage({ props }: { props: GridImageBlockProps; brand: BrandConfig }) {
  const radius = props.rounded ? "rounded-lg" : "";
  if (!props.imageUrl) {
    return (
      <div className={`w-full h-full min-h-[120px] bg-slate-100 grid place-items-center text-xs text-slate-500 ${radius}`}>
        Image
      </div>
    );
  }
  const img = (
    <img
      src={props.imageUrl}
      alt={props.alt || ""}
      className={`w-full h-full object-cover ${radius}`}
    />
  );
  return props.href ? (
    <a href={props.href} className="block w-full h-full">{img}</a>
  ) : img;
}

export function BlockGridHeadlineSub({ props }: { props: GridHeadlineSubBlockProps; brand: BrandConfig }) {
  return (
    <div className={`p-4 ${ALIGN_CLASS[props.align]}`}>
      <h3 className="text-2xl font-semibold text-slate-900">{props.headline}</h3>
      {props.subheadline && (
        <p className="mt-2 text-sm text-slate-600">{props.subheadline}</p>
      )}
    </div>
  );
}

export function BlockGridParagraphBullets({ props, brand }: { props: GridParagraphBulletsBlockProps; brand: BrandConfig }) {
  return (
    <div className="p-4 space-y-3">
      {props.paragraph && (
        <p className="text-base text-slate-700">{props.paragraph}</p>
      )}
      {props.bullets?.length > 0 && (
        <ul className="space-y-1.5 text-sm text-slate-700">
          {props.bullets.map((b: string, i: number) => (
            <li key={i} className="flex gap-2">
              <span
                className="mt-1 inline-block h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: brand?.primaryColor || "#003A30" }}
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BlockGridHeadlineParagraph({ props }: { props: GridHeadlineParagraphBlockProps; brand: BrandConfig }) {
  return (
    <div className={`p-4 ${ALIGN_CLASS[props.align]}`}>
      <h3 className="text-xl font-semibold text-slate-900">{props.headline}</h3>
      {props.paragraph && (
        <p className="mt-2 text-base text-slate-700 leading-relaxed">{props.paragraph}</p>
      )}
    </div>
  );
}

export function BlockGridIconFeature({ props, brand }: { props: GridIconFeatureBlockProps; brand: BrandConfig }) {
  return (
    <div className="p-4">
      <div
        className="h-10 w-10 grid place-items-center rounded-md text-xl mb-3"
        style={{ backgroundColor: brand?.accentColor || "#C7E73833" }}
      >
        <span aria-hidden>{props.icon || "✨"}</span>
      </div>
      <h4 className="text-base font-semibold text-slate-900">{props.headline}</h4>
      {props.paragraph && (
        <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{props.paragraph}</p>
      )}
    </div>
  );
}

export function BlockGridStat({ props, brand }: { props: GridStatBlockProps; brand: BrandConfig }) {
  return (
    <div className="p-4 text-center">
      <div
        className="text-4xl font-bold tracking-tight"
        style={{ color: brand?.primaryColor || "#003A30" }}
      >
        {props.value}
      </div>
      <div className="mt-2 text-sm font-medium text-slate-700">{props.label}</div>
      {props.caption && <div className="mt-1 text-xs text-slate-500">{props.caption}</div>}
    </div>
  );
}

export function BlockGridQuote({ props, brand }: { props: GridQuoteBlockProps; brand: BrandConfig }) {
  return (
    <div className="p-4">
      <div
        className="text-3xl leading-none mb-1"
        style={{ color: brand?.accentColor || "#C7E738" }}
        aria-hidden
      >
        &ldquo;
      </div>
      <p className="text-base italic text-slate-800 leading-relaxed">{props.quote}</p>
      <div className="mt-3 text-sm">
        <div className="font-semibold text-slate-900">{props.attribution}</div>
        {props.role && <div className="text-slate-500">{props.role}</div>}
      </div>
    </div>
  );
}

export function BlockGridCtaTile({ props }: { props: GridCtaTileBlockProps; brand: BrandConfig }) {
  return (
    <div
      className="p-6 rounded-lg h-full flex flex-col"
      style={{ backgroundColor: props.bgColor || "#003A30", color: props.textColor || "#ffffff" }}
    >
      <h4 className="text-lg font-semibold">{props.headline}</h4>
      {props.body && <p className="mt-2 text-sm opacity-90 flex-1">{props.body}</p>}
      {props.ctaText && (
        <a
          href={props.ctaUrl || "#"}
          className="mt-4 inline-flex self-start items-center px-4 py-2 rounded-full text-sm font-semibold bg-[#C7E738] text-[#003A30] hover:opacity-90"
        >
          {props.ctaText}
        </a>
      )}
    </div>
  );
}

export function BlockGridLogo({ props }: { props: GridLogoBlockProps; brand: BrandConfig }) {
  if (!props.logoUrl) {
    return (
      <div className="w-full h-24 bg-slate-100 grid place-items-center text-xs text-slate-500 rounded">
        Logo
      </div>
    );
  }
  const img = (
    <img
      src={props.logoUrl}
      alt={props.alt || "Logo"}
      className="max-h-16 max-w-full object-contain"
    />
  );
  const wrapper = (
    <div className="w-full h-24 grid place-items-center p-2">{img}</div>
  );
  return props.href ? (
    <a href={props.href} className="block">{wrapper}</a>
  ) : wrapper;
}

export function BlockGridVideo({ props }: { props: GridVideoBlockProps; brand: BrandConfig }) {
  if (!props.videoUrl) {
    return (
      <div className="w-full aspect-video bg-slate-900 grid place-items-center text-xs text-slate-300 rounded">
        Video
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <video
        src={props.videoUrl}
        poster={props.posterUrl || undefined}
        controls
        className="w-full aspect-video rounded bg-black"
      />
      {props.caption && <p className="text-xs text-slate-500">{props.caption}</p>}
    </div>
  );
}
