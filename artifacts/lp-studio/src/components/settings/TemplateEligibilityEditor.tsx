// TemplateEligibilityEditor — the per-template governance editor (June 2026).
//
// Lets an admin DECLARE where a template is allowed to be AUTO-recommended:
//   • Eligible segments  (multi-select; empty = Any)
//   • Eligible personas  (optional multi-select; empty = Any)
//   • Eligible funnel stages (multi-select from the fixed labeled list; empty = Any)
//   • Primary funnel stage (single)
//
// Empty on any axis = "Any" (wildcard). Reuses the shadcn Popover + Command
// (combobox) primitives for the multi-selects and the fixed FUNNEL_STAGE_OPTIONS
// list from lib/templateEligibility. Fully keyboard-accessible (Command handles
// arrow/enter; the trigger is a real button; selected chips are removable).
//
// Controlled: the parent owns the value + persists it (PUT /lp/pages/:id).
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  FUNNEL_STAGE_OPTIONS,
  funnelStageLabel,
  type TemplateEligibility,
} from "@/lib/templateEligibility";

export interface EligibilityOption {
  value: string;
  label: string;
  /** Optional second line in the dropdown row. */
  hint?: string;
}

/** A keyboard-accessible multi-select built on Popover + Command. */
function MultiSelect({
  id,
  label,
  helptext,
  emptyLabel,
  options,
  selected,
  onChange,
  disabled,
  searchPlaceholder,
}: {
  id: string;
  label: React.ReactNode;
  helptext: string;
  /** Shown on the trigger when nothing is selected (e.g. "Any segment"). */
  emptyLabel: string;
  options: EligibilityOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  searchPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const labelFor = useMemo(() => {
    const m = new Map(options.map((o) => [o.value, o.label]));
    return (v: string) => m.get(v) ?? v;
  }, [options]);

  function toggle(value: string) {
    if (selectedSet.has(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  }
  function remove(value: string) {
    onChange(selected.filter((v) => v !== value));
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          disabled={disabled || options.length === 0}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-left",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>
            {options.length === 0
              ? "None available"
              : selected.length === 0
                ? emptyLabel
                : `${selected.length} selected`}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => {
                  const checked = selectedSet.has(o.value);
                  return (
                    <CommandItem
                      key={o.value}
                      value={`${o.label} ${o.value}`}
                      onSelect={() => toggle(o.value)}
                      role="option"
                      aria-selected={checked}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4 shrink-0", checked ? "opacity-100" : "opacity-0")}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{o.label}</span>
                        {o.hint && (
                          <span className="block text-[11px] text-muted-foreground truncate">{o.hint}</span>
                        )}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected chips (removable). */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {selected.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              <span className="truncate max-w-[12rem]">{labelFor(v)}</span>
              <button
                type="button"
                onClick={() => remove(v)}
                disabled={disabled}
                aria-label={`Remove ${labelFor(v)}`}
                className="rounded-sm p-0.5 hover:bg-muted-foreground/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">{helptext}</p>
    </div>
  );
}

export function TemplateEligibilityEditor({
  value,
  onChange,
  segmentOptions,
  personaOptions,
  disabled,
}: {
  value: TemplateEligibility;
  onChange: (next: TemplateEligibility) => void;
  /** Segments from GET /sales/brand/segments. */
  segmentOptions: EligibilityOption[];
  /** Personas (across all segments) from GET /sales/brand/segments. */
  personaOptions: EligibilityOption[];
  disabled?: boolean;
}) {
  const stageOptions: EligibilityOption[] = useMemo(
    () =>
      FUNNEL_STAGE_OPTIONS.map((o) => ({
        value: o.value,
        label: o.label,
        hint: o.description,
      })),
    [],
  );

  return (
    <div className="space-y-4">
      <MultiSelect
        id="elig-segments"
        label="Eligible segments"
        emptyLabel="Any segment"
        helptext="Leave empty to allow any segment. AI will only auto-recommend this template for the segments you choose."
        options={segmentOptions}
        selected={value.eligibleSegments}
        onChange={(next) => onChange({ ...value, eligibleSegments: next })}
        disabled={disabled}
        searchPlaceholder="Search segments…"
      />

      <MultiSelect
        id="elig-personas"
        label={
          <>
            Eligible personas{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </>
        }
        emptyLabel="Any persona"
        helptext="Leave empty to allow any persona within the eligible segments."
        options={personaOptions}
        selected={value.eligiblePersonas}
        onChange={(next) => onChange({ ...value, eligiblePersonas: next })}
        disabled={disabled}
        searchPlaceholder="Search personas…"
      />

      <MultiSelect
        id="elig-stages"
        label="Eligible funnel stages"
        emptyLabel="Any stage"
        helptext="Leave empty to allow any funnel stage. Choose the sales motions this template fits."
        options={stageOptions}
        selected={value.eligibleFunnelStages}
        onChange={(next) => onChange({ ...value, eligibleFunnelStages: next })}
        disabled={disabled}
        searchPlaceholder="Search stages…"
      />

      {/* Primary funnel stage (single). */}
      <div className="space-y-1.5">
        <Label htmlFor="elig-primary-stage" className="text-xs font-medium">
          Primary funnel stage{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <select
          id="elig-primary-stage"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          value={value.funnelStage ?? ""}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...value, funnelStage: e.target.value ? e.target.value : null })
          }
        >
          <option value="">No primary stage</option>
          {FUNNEL_STAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          The single stage this template is most representative of. When no eligible stages are
          set above, the primary stage is used as the one allowed stage.
        </p>
      </div>

      {/* Live summary of what this means. */}
      <p className="text-[11px] text-muted-foreground">
        {value.eligibleSegments.length === 0 &&
        value.eligiblePersonas.length === 0 &&
        value.eligibleFunnelStages.length === 0
          ? "This template can be auto-recommended for any audience or stage."
          : `Auto-recommended for: ${[
              value.eligibleSegments.length
                ? `${value.eligibleSegments.length} segment(s)`
                : "any segment",
              value.eligiblePersonas.length
                ? `${value.eligiblePersonas.length} persona(s)`
                : "any persona",
              value.eligibleFunnelStages.length
                ? value.eligibleFunnelStages.map((s) => funnelStageLabel(s)).join(", ")
                : "any stage",
            ].join(" · ")}`}
      </p>
    </div>
  );
}
