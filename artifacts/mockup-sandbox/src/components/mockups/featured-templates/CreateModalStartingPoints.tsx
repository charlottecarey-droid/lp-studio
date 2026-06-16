import React, { useState } from "react";
import { X, ChevronDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)",
];

type Mode = "template" | "ai" | "brief";

const FEATURED = [
  { id: "f1", name: "Product Webinar", type: "Webinar", gradient: GRADIENTS[0] },
  { id: "f2", name: "Ebook Download", type: "Lead magnet", gradient: GRADIENTS[1] },
  { id: "f3", name: "Request a Demo", type: "Demo", gradient: GRADIENTS[2] },
  { id: "f4", name: "Spring Pricing", type: "Pricing", gradient: GRADIENTS[3] },
  { id: "f5", name: "Customer Story", type: "Case study", gradient: GRADIENTS[4] },
  { id: "f6", name: "Event Signup", type: "Event", gradient: GRADIENTS[5] },
];

export function CreateModalStartingPoints() {
  const [mode, setMode] = useState<Mode>("template");
  const [audience, setAudience] = useState("all");
  const [selection, setSelection] = useState("blank");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E5E4E2]/60 p-4 font-sans text-[#1A1A1A]">
      <div className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-[#EAE9E8] bg-[#FDFDFD] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-8 pb-6 pt-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-[#5C5C5C]">
              <span className="text-[10px] font-medium uppercase tracking-wide">Audience</span>
              <div className="relative">
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="cursor-pointer appearance-none bg-transparent py-1 pr-5 font-medium text-[#1A1A1A] focus:outline-none hover:text-black"
                >
                  <option value="all">All Audiences</option>
                  <option value="enterprise">Enterprise IT</option>
                  <option value="smb">Small Business</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 opacity-50" />
              </div>
            </div>
            <h1 className="font-serif text-2xl tracking-tight text-black">Create a new page</h1>
          </div>
          <button className="rounded-full p-2 text-[#8C8C8C] transition-colors hover:bg-[#F2F1F0] hover:text-[#1A1A1A]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Segmented control */}
        <div className="mb-8 px-8">
          <div className="flex rounded-lg bg-[#F2F1F0] p-1">
            {(
              [
                { id: "template", label: "Template" },
                { id: "ai", label: "AI Generate" },
                { id: "brief", label: "Start with Brief" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex-1 rounded-md py-2 text-sm font-medium transition-all",
                  mode === m.id
                    ? "bg-white text-black shadow-sm ring-1 ring-black/5"
                    : "text-[#5C5C5C] hover:text-[#1A1A1A]"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Template tab content */}
        <div className="px-8 pb-8">
          {mode === "template" ? (
            <div className="space-y-8">
              {/* Name + slug */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#5C5C5C]">
                    Page Name
                  </label>
                  <input className="w-full border-b border-[#EAE9E8] bg-transparent py-2 text-[15px] transition-colors focus:border-[#1A1A1A] focus:outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#5C5C5C]">
                    URL Slug
                  </label>
                  <div className="flex items-center border-b border-[#EAE9E8] py-2 transition-colors focus-within:border-[#1A1A1A]">
                    <span className="text-[15px] text-[#8C8C8C]">/lp/</span>
                    <input className="ml-0.5 w-full bg-transparent text-[15px] focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* Starting point — featured templates, horizontally scrollable */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#5C5C5C]">
                    Starting Point
                  </label>
                  <span className="flex items-center gap-1 text-[11px] text-[#8C8C8C]">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    Your featured templates
                  </span>
                </div>

                <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
                  {/* Blank + basic always lead */}
                  {[
                    { id: "blank", name: "Blank Canvas", type: "General" },
                    { id: "basic", name: "Basic Layout", type: "General" },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => setSelection(tpl.id)}
                      className="group w-[150px] shrink-0 snap-start text-left"
                    >
                      <div
                        className={cn(
                          "mb-2 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-[#F9F9F9] transition-all",
                          selection === tpl.id
                            ? "border-[#1A1A1A] shadow-sm"
                            : "border-[#EAE9E8] group-hover:border-[#C4C4C4]"
                        )}
                      >
                        {tpl.id === "blank" ? (
                          <div className="h-8 w-8 rounded-full border border-dashed border-[#C4C4C4]" />
                        ) : (
                          <div className="flex h-full w-full flex-col gap-1.5 p-2 opacity-50">
                            <div className="h-2 w-full rounded-sm bg-[#EAE9E8]" />
                            <div className="h-2 w-2/3 rounded-sm bg-[#EAE9E8]" />
                            <div className="mt-auto h-4 w-1/2 rounded-sm bg-[#EAE9E8]" />
                          </div>
                        )}
                      </div>
                      <div className="text-[13px] font-medium text-[#1A1A1A]">{tpl.name}</div>
                      <div className="text-[11px] text-[#8C8C8C]">{tpl.type}</div>
                    </button>
                  ))}

                  {/* Featured templates */}
                  {FEATURED.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => setSelection(tpl.id)}
                      className="group w-[150px] shrink-0 snap-start text-left"
                    >
                      <div
                        className={cn(
                          "relative mb-2 aspect-[4/3] overflow-hidden rounded-lg border transition-all",
                          selection === tpl.id
                            ? "border-[#1A1A1A] shadow-sm ring-2 ring-[#1A1A1A]/10"
                            : "border-[#EAE9E8] group-hover:border-[#C4C4C4]"
                        )}
                      >
                        <div className="absolute inset-0" style={{ background: tpl.gradient }} />
                        <Star className="absolute right-1.5 top-1.5 h-3.5 w-3.5 fill-amber-300 text-amber-300 drop-shadow" />
                      </div>
                      <div className="text-[13px] font-medium text-[#1A1A1A]">{tpl.name}</div>
                      <div className="text-[11px] text-[#8C8C8C]">{tpl.type}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#8C8C8C]">
                  Scroll to see all {FEATURED.length} featured templates · manage these on the Templates page
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button className="rounded-lg bg-[#1A1A1A] px-6 py-2.5 text-sm font-medium text-white outline-none transition-colors hover:bg-black focus:ring-2 focus:ring-[#1A1A1A] focus:ring-offset-2">
                  Create page
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-[#8C8C8C]">
              {mode === "ai" ? "AI Generate panel" : "Start with Brief panel"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateModalStartingPoints;
