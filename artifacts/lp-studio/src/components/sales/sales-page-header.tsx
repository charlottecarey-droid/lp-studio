import * as React from "react";

interface SalesPageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { onClick: () => void; label?: string };
  actions?: React.ReactNode;
}

export function SalesPageHeader({ title, description, back, actions }: SalesPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <button
            onClick={back.onClick}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            {back.label ?? "Back"}
          </button>
        )}
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {/* flex-wrap + no shrink-0: a page with many actions wraps them instead
          of crushing the title into a one-word-per-line column. */}
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}
