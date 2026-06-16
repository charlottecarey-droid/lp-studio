import React, { useState } from "react";
import { X, ChevronDown, Check, Image as ImageIcon, Link2, Plus, Sparkles, BookOpen, LayoutTemplate, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "template" | "ai" | "brief";

export function SegmentedCalm() {
  const [mode, setMode] = useState<Mode>("template");
  const [audience, setAudience] = useState("all");
  const [templateSelection, setTemplateSelection] = useState("blank");
  const [aiStartPoint, setAiStartPoint] = useState<"scratch" | "template">("scratch");
  const [replaceImagery, setReplaceImagery] = useState(false);
  
  const [refUrls, setRefUrls] = useState<string[]>([]);
  const [pendingRefUrl, setPendingRefUrl] = useState("");

  const handleAddRefUrl = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && pendingRefUrl.trim()) {
      e.preventDefault();
      if (refUrls.length < 5) {
        setRefUrls([...refUrls, pendingRefUrl.trim()]);
        setPendingRefUrl("");
      }
    }
  };

  const removeRefUrl = (index: number) => {
    setRefUrls(refUrls.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-[#E5E4E2]/60 flex items-center justify-center p-4 font-sans text-[#1A1A1A]">
      {/* Modal Container */}
      <div className="w-full max-w-[640px] bg-[#FDFDFD] shadow-2xl rounded-2xl overflow-hidden border border-[#EAE9E8]">
        
        {/* Header Area */}
        <div className="px-8 pt-8 pb-6 flex items-start justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-[#5C5C5C]">
              <span className="font-medium tracking-wide uppercase text-[10px]">Audience</span>
              <div className="relative">
                <select 
                  value={audience}
                  onChange={e => setAudience(e.target.value)}
                  className="appearance-none bg-transparent pr-5 py-1 focus:outline-none cursor-pointer font-medium text-[#1A1A1A] hover:text-[#000]"
                >
                  <option value="all">All Audiences</option>
                  <option value="enterprise">Enterprise IT</option>
                  <option value="smb">Small Business</option>
                  <option value="healthcare">Healthcare</option>
                </select>
                <ChevronDown className="w-3 h-3 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
              </div>
            </div>
            <h1 className="text-2xl font-serif tracking-tight text-[#000]">Create a new page</h1>
          </div>
          
          <button className="p-2 rounded-full hover:bg-[#F2F1F0] transition-colors text-[#8C8C8C] hover:text-[#1A1A1A]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Control */}
        <div className="px-8 mb-8">
          <div className="flex p-1 bg-[#F2F1F0] rounded-lg">
            {( [
              { id: "template", label: "Template" },
              { id: "ai", label: "AI Generate" },
              { id: "brief", label: "Start with Brief" }
            ] as const ).map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                  mode === m.id 
                    ? "bg-white text-[#000] shadow-sm ring-1 ring-black/5" 
                    : "text-[#5C5C5C] hover:text-[#1A1A1A]"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="px-8 pb-8">
          {mode === "template" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold tracking-wide text-[#5C5C5C] uppercase">Page Name</label>
                  <input type="text" className="w-full bg-transparent border-b border-[#EAE9E8] py-2 focus:outline-none focus:border-[#1A1A1A] transition-colors text-[15px]" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold tracking-wide text-[#5C5C5C] uppercase">URL Slug</label>
                  <div className="flex items-center border-b border-[#EAE9E8] py-2 focus-within:border-[#1A1A1A] transition-colors">
                    <span className="text-[#8C8C8C] text-[15px]">/lp/</span>
                    <input type="text" className="w-full bg-transparent focus:outline-none text-[15px] ml-0.5" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-semibold tracking-wide text-[#5C5C5C] uppercase">Starting Point</label>
                
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: "blank", name: "Blank Canvas", type: "General" },
                    { id: "basic", name: "Basic Layout", type: "General" },
                    { id: "webinar", name: "Webinar", type: "Template" },
                    { id: "ebook", name: "Ebook Download", type: "Template" },
                    { id: "demo", name: "Request Demo", type: "Template" },
                    { id: "pricing", name: "Pricing", type: "Template" },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => setTemplateSelection(tpl.id)}
                      className={cn(
                        "text-left group transition-all",
                        templateSelection === tpl.id ? "opacity-100" : "opacity-60 hover:opacity-100"
                      )}
                    >
                      <div className={cn(
                        "aspect-[4/3] rounded-lg border flex items-center justify-center mb-2 overflow-hidden bg-[#F9F9F9]",
                        templateSelection === tpl.id ? "border-[#1A1A1A] shadow-sm" : "border-[#EAE9E8] group-hover:border-[#C4C4C4]"
                      )}>
                        {tpl.id === "blank" ? (
                          <div className="w-8 h-8 rounded-full border border-dashed border-[#C4C4C4]" />
                        ) : (
                          <div className="w-full h-full p-2 flex flex-col gap-1.5 opacity-50">
                            <div className="w-full h-2 bg-[#EAE9E8] rounded-sm" />
                            <div className="w-2/3 h-2 bg-[#EAE9E8] rounded-sm" />
                            <div className="w-1/2 h-4 bg-[#EAE9E8] rounded-sm mt-auto" />
                          </div>
                        )}
                      </div>
                      <div className="text-[13px] font-medium text-[#1A1A1A]">{tpl.name}</div>
                      <div className="text-[11px] text-[#8C8C8C]">{tpl.type}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button className="bg-[#1A1A1A] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-black transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-[#1A1A1A] outline-none">
                  Create page
                </button>
              </div>
            </div>
          )}

          {mode === "ai" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-wide text-[#5C5C5C] uppercase">Prompt</label>
                <textarea 
                  rows={4}
                  className="w-full bg-[#F9F9F9] border border-[#EAE9E8] rounded-xl p-4 focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-colors text-[15px] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-xs font-semibold tracking-wide text-[#5C5C5C] uppercase">Foundation</label>
                  <div className="flex bg-[#F2F1F0] p-1 rounded-lg w-full">
                    <button onClick={() => setAiStartPoint("scratch")} className={cn("flex-1 py-1.5 text-[13px] font-medium rounded-md transition-all", aiStartPoint === "scratch" ? "bg-white text-[#000] shadow-sm" : "text-[#5C5C5C]")}>Scratch</button>
                    <button onClick={() => setAiStartPoint("template")} className={cn("flex-1 py-1.5 text-[13px] font-medium rounded-md transition-all", aiStartPoint === "template" ? "bg-white text-[#000] shadow-sm" : "text-[#5C5C5C]")}>Template</button>
                  </div>
                  {aiStartPoint === "template" && (
                    <div className="relative">
                      <select className="w-full appearance-none bg-transparent border-b border-[#EAE9E8] py-2 focus:outline-none focus:border-[#1A1A1A] text-[14px]">
                        <option>Webinar Layout</option>
                        <option>Ebook Download</option>
                        <option>Pricing Table</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 absolute right-0 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-semibold tracking-wide text-[#5C5C5C] uppercase flex items-center justify-between">
                    <span>Reference URLs</span>
                    <span className="text-[10px] text-[#8C8C8C] normal-case font-normal">{refUrls.length}/5</span>
                  </label>
                  <div className="space-y-2">
                    {refUrls.map((url, i) => (
                      <div key={i} className="flex items-center justify-between bg-[#F9F9F9] border border-[#EAE9E8] rounded-md px-3 py-1.5 group">
                        <span className="text-[13px] text-[#1A1A1A] truncate pr-4">{url}</span>
                        <button onClick={() => removeRefUrl(i)} className="opacity-0 group-hover:opacity-100 text-[#8C8C8C] hover:text-[#1A1A1A]">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {refUrls.length < 5 && (
                      <div className="flex items-center border-b border-[#EAE9E8] py-1.5 focus-within:border-[#1A1A1A] transition-colors">
                        <Link2 className="w-3.5 h-3.5 text-[#8C8C8C] mr-2" />
                        <input 
                          type="text" 
                          value={pendingRefUrl}
                          onChange={e => setPendingRefUrl(e.target.value)}
                          onKeyDown={handleAddRefUrl}
                          className="w-full bg-transparent focus:outline-none text-[13px]" 
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#EAE9E8] pt-6">
                <div className="flex items-center gap-6">
                  <button className="flex items-center gap-2 text-[13px] font-medium text-[#5C5C5C] hover:text-[#1A1A1A] transition-colors">
                    <ImageIcon className="w-4 h-4" />
                    Attach screenshot
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center transition-colors", replaceImagery ? "bg-[#1A1A1A] border-[#1A1A1A]" : "border-[#C4C4C4] group-hover:border-[#8C8C8C]")}>
                      {replaceImagery && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-[13px] font-medium text-[#5C5C5C] group-hover:text-[#1A1A1A] transition-colors">Use brand imagery</span>
                    <input type="checkbox" className="hidden" checked={replaceImagery} onChange={e => setReplaceImagery(e.target.checked)} />
                  </label>
                </div>
                
                <button className="bg-[#1A1A1A] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-black transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-[#1A1A1A] outline-none flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Generate page
                </button>
              </div>

            </div>
          )}

          {mode === "brief" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-wide text-[#5C5C5C] uppercase">Target Company or Audience</label>
                <input type="text" className="w-full bg-transparent border-b border-[#EAE9E8] py-2 focus:outline-none focus:border-[#1A1A1A] transition-colors text-[15px]" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-wide text-[#5C5C5C] uppercase">Campaign Objective</label>
                <input type="text" className="w-full bg-transparent border-b border-[#EAE9E8] py-2 focus:outline-none focus:border-[#1A1A1A] transition-colors text-[15px]" />
              </div>

              <div className="pt-4 flex items-center justify-between">
                <p className="text-[13px] text-[#8C8C8C] max-w-[280px] leading-relaxed">
                  Generates a strategy brief you can later turn into a structured landing page.
                </p>
                <button className="bg-[#1A1A1A] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-black transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-[#1A1A1A] outline-none flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Generate brief
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default SegmentedCalm;