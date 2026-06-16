import React, { useState } from "react";
import { 
  Sparkles, 
  LayoutTemplate, 
  FileText, 
  X, 
  ChevronDown, 
  Plus, 
  Image as ImageIcon, 
  Link2,
  Users
} from "lucide-react";

export default function GuidedRail() {
  const [activeMode, setActiveMode] = useState<"template" | "ai" | "brief">("template");
  const [audience, setAudience] = useState("all");
  const [aiStartChoice, setAiStartChoice] = useState<"scratch" | "template">("scratch");
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [replaceImagery, setReplaceImagery] = useState(false);

  const addUrl = () => {
    if (newUrl && referenceUrls.length < 5) {
      setReferenceUrls([...referenceUrls, newUrl]);
      setNewUrl("");
    }
  };

  const generalTemplates = [
    { id: "blank", name: "Blank Page" },
    { id: "basic", name: "Basic Layout" },
  ];

  const richTemplates = [
    { id: "saas", name: "SaaS Product" },
    { id: "event", name: "Event Registration" },
    { id: "webinar", name: "Webinar Sign-up" },
    { id: "ebook", name: "eBook Download" },
  ];

  return (
    <div className="min-h-screen bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans antialiased text-slate-900 selection:bg-blue-100">
      <div className="w-full max-w-[960px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[640px] border border-slate-200/60 ring-1 ring-black/5">
        
        {/* LEFT RAIL */}
        <div className="w-full md:w-[300px] bg-slate-900 flex flex-col p-6 shrink-0 relative text-slate-300">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Create Page</h2>
          </div>

          <div className="mb-10">
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-widest">
              <Users className="w-3.5 h-3.5" />
              Audience Segment
            </label>
            <div className="relative">
              <select 
                className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all cursor-pointer"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                <option value="all">All Audiences</option>
                <option value="enterprise">Enterprise IT</option>
                <option value="smb">Small business owners</option>
                <option value="healthcare">Healthcare Providers</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <nav className="flex-1 space-y-1.5">
            <button
              onClick={() => setActiveMode("template")}
              className={`w-full text-left p-3.5 rounded-xl transition-all border ${
                activeMode === "template" 
                  ? "bg-slate-800 border-slate-700 shadow-inner" 
                  : "hover:bg-slate-800/50 border-transparent text-slate-400"
              }`}
            >
              <div className="flex items-center gap-3 mb-1">
                <LayoutTemplate className={`w-4 h-4 ${activeMode === "template" ? "text-blue-400" : "text-slate-500"}`} />
                <span className={`text-sm font-semibold ${activeMode === "template" ? "text-white" : ""}`}>Template</span>
              </div>
              <p className="text-xs text-slate-500 ml-7">Copy a pre-built layout</p>
            </button>

            <button
              onClick={() => setActiveMode("ai")}
              className={`w-full text-left p-3.5 rounded-xl transition-all border ${
                activeMode === "ai" 
                  ? "bg-slate-800 border-slate-700 shadow-inner" 
                  : "hover:bg-slate-800/50 border-transparent text-slate-400"
              }`}
            >
              <div className="flex items-center gap-3 mb-1">
                <Sparkles className={`w-4 h-4 ${activeMode === "ai" ? "text-blue-400" : "text-slate-500"}`} />
                <span className={`text-sm font-semibold ${activeMode === "ai" ? "text-white" : ""}`}>AI Generate</span>
              </div>
              <p className="text-xs text-slate-500 ml-7">Prompt to build from scratch</p>
            </button>

            <button
              onClick={() => setActiveMode("brief")}
              className={`w-full text-left p-3.5 rounded-xl transition-all border ${
                activeMode === "brief" 
                  ? "bg-slate-800 border-slate-700 shadow-inner" 
                  : "hover:bg-slate-800/50 border-transparent text-slate-400"
              }`}
            >
              <div className="flex items-center gap-3 mb-1">
                <FileText className={`w-4 h-4 ${activeMode === "brief" ? "text-blue-400" : "text-slate-500"}`} />
                <span className={`text-sm font-semibold ${activeMode === "brief" ? "text-white" : ""}`}>Strategy Brief</span>
              </div>
              <p className="text-xs text-slate-500 ml-7">Plan strategy and copy</p>
            </button>
          </nav>

        </div>

        {/* RIGHT PANE */}
        <div className="flex-1 flex flex-col bg-slate-50 relative">
          <button className="absolute top-5 right-5 p-1.5 rounded-md hover:bg-slate-200/50 transition-colors text-slate-400 hover:text-slate-600 z-10">
            <X className="w-5 h-5" />
          </button>

          <div className="flex-1 overflow-y-auto px-10 py-10">
            {activeMode === "template" && (
              <div className="max-w-xl animate-in fade-in slide-in-from-right-2 duration-300">
                <h3 className="text-lg font-semibold text-slate-900 mb-8">Start from Template</h3>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Page Name</label>
                      <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm" />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">URL Slug</label>
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 shadow-sm transition-shadow">
                        <span className="bg-slate-50 px-3 py-2.5 text-sm text-slate-400 border-r border-slate-200 font-medium select-none">/lp/</span>
                        <input type="text" className="w-full px-3 py-2.5 text-sm focus:outline-none bg-transparent" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <label className="block text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-widest">General</label>
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {generalTemplates.map(t => (
                        <button key={t.id} className="text-left group outline-none">
                          <div className="aspect-[4/3] bg-white rounded-xl border border-slate-200 group-hover:border-blue-500 group-hover:ring-1 group-hover:ring-blue-500 transition-all mb-2 flex items-center justify-center shadow-sm">
                            <LayoutTemplate className="w-6 h-6 text-slate-300 group-hover:text-blue-500 transition-colors" />
                          </div>
                          <p className="text-xs font-semibold text-slate-700 group-hover:text-blue-700 px-1">{t.name}</p>
                        </button>
                      ))}
                    </div>

                    <label className="block text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-widest">Templates</label>
                    <div className="grid grid-cols-3 gap-3">
                      {richTemplates.map(t => (
                        <button key={t.id} className="text-left group outline-none">
                          <div className="aspect-[4/3] bg-white rounded-xl border border-slate-200 group-hover:border-blue-500 group-hover:ring-1 group-hover:ring-blue-500 transition-all mb-2 flex items-center justify-center shadow-sm">
                            <LayoutTemplate className="w-6 h-6 text-slate-300 group-hover:text-blue-500 transition-colors" />
                          </div>
                          <p className="text-xs font-semibold text-slate-700 group-hover:text-blue-700 px-1">{t.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeMode === "ai" && (
              <div className="max-w-xl animate-in fade-in slide-in-from-right-2 duration-300">
                <h3 className="text-lg font-semibold text-slate-900 mb-8 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  Generate with AI
                </h3>

                <div className="space-y-6">
                  <div className="flex gap-1.5 p-1 bg-slate-200/50 rounded-lg w-fit border border-slate-200">
                    <button 
                      className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${aiStartChoice === "scratch" ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-700"}`}
                      onClick={() => setAiStartChoice("scratch")}
                    >
                      From Scratch
                    </button>
                    <button 
                      className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${aiStartChoice === "template" ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-700"}`}
                      onClick={() => setAiStartChoice("template")}
                    >
                      From Template
                    </button>
                  </div>

                  {aiStartChoice === "template" && (
                     <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                       <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Base Template</label>
                       <select className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm cursor-pointer">
                         {[...generalTemplates, ...richTemplates].map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                       </select>
                     </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Page Description</label>
                    <textarea 
                      className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[100px] resize-none shadow-sm"
                    ></textarea>
                  </div>

                  <div className="space-y-4 pt-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2">Context & Assets</label>
                    
                    <div className="flex flex-col gap-4">
                      <div>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input 
                              type="text" 
                              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm" 
                              value={newUrl}
                              onChange={e => setNewUrl(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && addUrl()}
                              disabled={referenceUrls.length >= 5}
                            />
                          </div>
                          <button 
                            onClick={addUrl} 
                            disabled={!newUrl || referenceUrls.length >= 5}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add URL
                          </button>
                        </div>
                        
                        {referenceUrls.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {referenceUrls.map((url, i) => (
                              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100/50">
                                {url}
                                <button onClick={() => setReferenceUrls(referenceUrls.filter((_, idx) => idx !== i))} className="hover:text-blue-900">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <button className="w-full bg-white border border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center gap-2 text-slate-500 hover:bg-slate-100/50 hover:border-slate-400 transition-colors group">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-white transition-colors">
                          <ImageIcon className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-xs font-semibold">Attach Screenshot</span>
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer group pt-2">
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox" 
                        className="peer sr-only"
                        checked={replaceImagery}
                        onChange={(e) => setReplaceImagery(e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-slate-200 border border-slate-300 rounded-full peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-colors shadow-inner"></div>
                      <div className="w-3.5 h-3.5 bg-white rounded-full absolute left-[3px] top-[3px] peer-checked:translate-x-4 transition-transform shadow-sm"></div>
                    </div>
                    <span className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">Replace template images with brand imagery</span>
                  </label>

                </div>
              </div>
            )}

            {activeMode === "brief" && (
              <div className="max-w-xl animate-in fade-in slide-in-from-right-2 duration-300">
                <h3 className="text-lg font-semibold text-slate-900 mb-8 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Strategy Brief
                </h3>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Target Company or Audience</label>
                    <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Campaign Objective</label>
                    <textarea className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[120px] resize-none shadow-sm"></textarea>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200/60 p-5 bg-white shrink-0 flex justify-end gap-3 z-10">
            <button className="px-5 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            {activeMode === "template" && (
              <button className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
                Create Page
              </button>
            )}
            {activeMode === "ai" && (
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm">
                <Sparkles className="w-4 h-4" /> Generate Page
              </button>
            )}
            {activeMode === "brief" && (
              <button className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm">
                <FileText className="w-4 h-4" /> Generate Brief
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
