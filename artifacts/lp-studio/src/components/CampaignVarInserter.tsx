import { useState } from "react";
import { Megaphone } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  SALES_CONTACT_VARIABLES,
  LANDING_PAGE_VARIABLES,
  variableInsertText,
} from "@workspace/notification-variables";

export interface VarInserterItem {
  token: string;
  label: string;
  description: string;
  /** Optional grouping header shown above the item (e.g. "Contact"). */
  group?: string;
}

/**
 * The default list offered everywhere the merge-field inserter is used (sales
 * email composer + page builder property panels). Sourced from the shared
 * @workspace/notification-variables catalog so the pill an author clicks and
 * the value the server fills in can never drift, and so every surface shows the
 * same complete set — contact fields plus landing-page fields.
 */
const DEFAULT_VARS: VarInserterItem[] = [
  ...SALES_CONTACT_VARIABLES,
  ...LANDING_PAGE_VARIABLES,
].map((v) => ({
  token: variableInsertText(v),
  label: v.label,
  description: v.description,
  group: v.group,
}));

interface Props {
  onInsert: (token: string) => void;
  /** Variables to offer. Defaults to the shared sales/landing merge fields. */
  variables?: VarInserterItem[];
  /** Heading shown above the list. */
  title?: string;
  /** Footnote shown below the list (omit to hide). */
  footnote?: string;
}

const DEFAULT_FOOTNOTE =
  "Variables are auto-replaced when a contact visits their personalized page link.";

export function CampaignVarInserter({
  onInsert,
  variables = DEFAULT_VARS,
  title = "Merge fields",
  footnote = DEFAULT_FOOTNOTE,
}: Props) {
  const [open, setOpen] = useState(false);

  // Group items by their optional `group`, preserving first-seen order. Items
  // with no group fall under a single unlabeled section (flat list) — keeping
  // callers that pass an ungrouped list (e.g. the superadmin editor) unchanged.
  const groups: { name: string | undefined; items: VarInserterItem[] }[] = [];
  for (const item of variables) {
    let g = groups.find((x) => x.name === item.group);
    if (!g) {
      g = { name: item.group, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/30 gap-1"
          title="Insert merge field"
        >
          <Megaphone className="w-3 h-3" />
          Vars
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <p className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </p>
        {groups.map((group) => (
          <div key={group.name ?? "_"}>
            {group.name && (
              <p className="px-2 pt-1.5 pb-0.5 text-[10px] font-medium text-muted-foreground/80 uppercase tracking-wider">
                {group.name}
              </p>
            )}
            {group.items.map(({ token, label, description }) => (
              <button
                key={token}
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex flex-col gap-0.5"
                onClick={() => {
                  onInsert(token);
                  setOpen(false);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{label}</span>
                  <code className="text-[10px] text-violet-600 dark:text-violet-400 font-mono">{token}</code>
                </div>
                <span className="text-[10px] text-muted-foreground">{description}</span>
              </button>
            ))}
          </div>
        ))}
        {footnote && (
          <div className="border-t mt-1 pt-1 px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground leading-relaxed">{footnote}</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
