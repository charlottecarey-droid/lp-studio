import React, { useState } from "react";
import { 
  ArrowLeft, 
  X, 
  LayoutTemplate, 
  Sparkles, 
  BookOpen, 
  Upload, 
  Link as LinkIcon, 
  Image as ImageIcon,
  ChevronDown
} from "lucide-react";

// Minimal custom UI components to avoid dependency issues while maintaining a premium look
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={`flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${className}`}
    {...props}
  />
));
Input.displayName = "Input";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={`text-[13px] font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-zinc-900 ${className}`}
    {...props}
  />
));
Label.displayName = "Label";

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' }>(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: "bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90 shadow-sm",
    outline: "border border-zinc-200 bg-white hover:bg-zinc-100 hover:text-zinc-900 text-zinc-900 shadow-sm",
    ghost: "hover:bg-zinc-100 hover:text-zinc-900 text-zinc-600",
  };
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 ${variants[variant]} ${className}`}
      {...props}
    />
  );
});
Button.displayName = "Button";

type Mode = "template" | "ai" | "brief" | null;

export function FocusedFlow() {
  const [mode, setMode] = useState<Mode>(null);
  const [audience, setAudience] = useState("all");

  const [aiStartFrom, setAiStartFrom] = useState<"scratch" | "template">("scratch");
  const [replaceImages, setReplaceImages] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("blank");

  return (
    <div className="min-h-screen bg-zinc-100/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans text-zinc-900 selection:bg-zinc-200">
      <div className="bg-white rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] ring-1 ring-zinc-900/5 w-full max-w-2xl overflow-hidden flex flex-col relative transition-all duration-500 ease-out transform">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-white/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            {mode && (
              <button 
                onClick={() => setMode(null)}
                className="p-1.5 -ml-2 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">
              {!mode && "Create a new page"}
              {mode === "template" && "Start from Template"}
              {mode === "ai" && "AI Generation"}
              {mode === "brief" && "Strategic Brief"}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <select 
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="appearance-none text-[13px] border border-zinc-200 bg-white hover:bg-zinc-50 py-1.5 pl-3 pr-8 rounded-md text-zinc-700 font-medium cursor-pointer outline-none focus:ring-2 focus:ring-zinc-900/20 transition-all shadow-sm"
              >
                <option value="all">All Audiences</option>
                <option value="enterprise">Enterprise IT</option>
                <option value="smb">Small Business</option>
                <option value="healthcare">Healthcare</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-zinc-600 transition-colors" />
            </div>
            <button className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 relative">
          {!mode && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button 
                onClick={() => setMode("template")}
                className="group relative flex flex-col items-start text-left p-6 rounded-xl border border-zinc-200 hover:border-zinc-300 hover:shadow-md bg-white transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-50 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200/50 text-zinc-700 flex items-center justify-center mb-5 group-hover:scale-105 group-hover:bg-zinc-900 group-hover:text-white transition-all duration-300 shadow-sm">
                    <LayoutTemplate className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-zinc-900 mb-1 tracking-tight text-base">Template</h3>
                  <p className="text-[13px] text-zinc-500 leading-relaxed">Structured layout control</p>
                </div>
              </button>
              
              <button 
                onClick={() => setMode("ai")}
                className="group relative flex flex-col items-start text-left p-6 rounded-xl border border-zinc-200 hover:border-zinc-300 hover:shadow-md bg-white transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200/50 text-zinc-700 flex items-center justify-center mb-5 group-hover:scale-105 group-hover:bg-violet-600 group-hover:text-white transition-all duration-300 shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-zinc-900 mb-1 tracking-tight text-base">AI Generate</h3>
                  <p className="text-[13px] text-zinc-500 leading-relaxed">Describe to build</p>
                </div>
              </button>

              <button 
                onClick={() => setMode("brief")}
                className="group relative flex flex-col items-start text-left p-6 rounded-xl border border-zinc-200 hover:border-zinc-300 hover:shadow-md bg-white transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200/50 text-zinc-700 flex items-center justify-center mb-5 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-zinc-900 mb-1 tracking-tight text-base">Start with Brief</h3>
                  <p className="text-[13px] text-zinc-500 leading-relaxed">Strategy first</p>
                </div>
              </button>
            </div>
          )}

          {mode === "template" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-300">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Page Name</Label>
                  <Input />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug</Label>
                  <div className="flex rounded-md shadow-sm">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-zinc-200 bg-zinc-50 text-zinc-500 sm:text-sm font-medium">
                      /lp/
                    </span>
                    <Input className="rounded-l-none focus-visible:z-10 shadow-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Starting Point</Label>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">General</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <button onClick={() => setSelectedTemplate("blank")} className={`group flex flex-col gap-2 transition-all text-left ${selectedTemplate === "blank" ? "" : "opacity-70 hover:opacity-100"}`}>
                        <div className={`w-full aspect-[4/3] bg-zinc-50 rounded-lg border flex items-center justify-center transition-all ${selectedTemplate === "blank" ? "border-zinc-900 ring-1 ring-zinc-900 shadow-sm" : "border-zinc-200 group-hover:border-zinc-300"}`}>
                          <LayoutTemplate className="w-6 h-6 text-zinc-400" />
                        </div>
                        <p className={`text-[13px] font-medium ${selectedTemplate === "blank" ? "text-zinc-900" : "text-zinc-600"}`}>Blank</p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Templates</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <button onClick={() => setSelectedTemplate("saas")} className={`group flex flex-col gap-2 transition-all text-left ${selectedTemplate === "saas" ? "" : "opacity-70 hover:opacity-100"}`}>
                        <div className={`w-full aspect-[4/3] bg-white rounded-lg border overflow-hidden transition-all ${selectedTemplate === "saas" ? "border-zinc-900 ring-1 ring-zinc-900 shadow-sm" : "border-zinc-200 group-hover:border-zinc-300"}`}>
                           <div className="w-full h-4 bg-zinc-100 border-b border-zinc-100"></div>
                           <div className="w-full h-8 bg-zinc-50 flex justify-center items-center"><div className="w-1/2 h-2 bg-zinc-200 rounded-full"></div></div>
                           <div className="w-full h-10 bg-zinc-100 mt-2"></div>
                        </div>
                        <p className={`text-[13px] font-medium ${selectedTemplate === "saas" ? "text-zinc-900" : "text-zinc-600"}`}>SaaS Hero</p>
                      </button>
                      <button onClick={() => setSelectedTemplate("event")} className={`group flex flex-col gap-2 transition-all text-left ${selectedTemplate === "event" ? "" : "opacity-70 hover:opacity-100"}`}>
                        <div className={`w-full aspect-[4/3] bg-zinc-900 rounded-lg border overflow-hidden transition-all ${selectedTemplate === "event" ? "border-zinc-900 ring-1 ring-zinc-900 shadow-sm" : "border-zinc-800 group-hover:border-zinc-700"}`}>
                           <div className="w-full h-10 bg-zinc-800 flex justify-center items-center"><div className="w-1/3 h-2 bg-zinc-700 rounded-full"></div></div>
                           <div className="w-full h-10 bg-zinc-900 mt-1 flex gap-1 px-2"><div className="w-1/2 h-full bg-zinc-800 rounded-t-sm"></div><div className="w-1/2 h-full bg-zinc-800 rounded-t-sm"></div></div>
                        </div>
                        <p className={`text-[13px] font-medium ${selectedTemplate === "event" ? "text-zinc-900" : "text-zinc-600"}`}>Event</p>
                      </button>
                      <button onClick={() => setSelectedTemplate("webinar")} className={`group flex flex-col gap-2 transition-all text-left ${selectedTemplate === "webinar" ? "" : "opacity-70 hover:opacity-100"}`}>
                        <div className={`w-full aspect-[4/3] bg-white rounded-lg border overflow-hidden flex flex-col px-1.5 pt-1.5 gap-1.5 transition-all ${selectedTemplate === "webinar" ? "border-zinc-900 ring-1 ring-zinc-900 shadow-sm" : "border-zinc-200 group-hover:border-zinc-300"}`}>
                           <div className="w-full h-6 bg-zinc-100 rounded-sm"></div>
                           <div className="flex gap-1.5"><div className="w-1/2 h-8 bg-zinc-50 border border-zinc-100 rounded-sm"></div><div className="w-1/2 h-8 bg-zinc-50 border border-zinc-100 rounded-sm"></div></div>
                        </div>
                        <p className={`text-[13px] font-medium ${selectedTemplate === "webinar" ? "text-zinc-900" : "text-zinc-600"}`}>Webinar</p>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button>
                  Create Page
                </Button>
              </div>
            </div>
          )}

          {mode === "ai" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
              
              <div className="flex gap-1 p-1 bg-zinc-100/80 rounded-lg w-max border border-zinc-200/50 shadow-inner">
                <button 
                  onClick={() => setAiStartFrom("scratch")}
                  className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-all duration-200 ${aiStartFrom === "scratch" ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-900/5" : "text-zinc-500 hover:text-zinc-900"}`}
                >
                  From Scratch
                </button>
                <button 
                  onClick={() => setAiStartFrom("template")}
                  className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-all duration-200 ${aiStartFrom === "template" ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-900/5" : "text-zinc-500 hover:text-zinc-900"}`}
                >
                  From Template
                </button>
              </div>

              {aiStartFrom === "template" && (
                <div className="flex gap-3 overflow-x-auto pb-2 -mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="h-12 px-4 rounded-lg bg-zinc-900 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-sm">
                    <span className="text-[13px] font-medium">SaaS Hero</span>
                  </div>
                  <div className="h-12 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 flex items-center justify-center shrink-0 cursor-pointer transition-colors">
                    <span className="text-[13px] font-medium">Event</span>
                  </div>
                  <div className="h-12 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 flex items-center justify-center shrink-0 cursor-pointer transition-colors">
                    <span className="text-[13px] font-medium">Webinar</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Page Description</Label>
                <textarea 
                  className="w-full bg-white border border-zinc-200 rounded-lg p-3 min-h-[120px] text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent resize-none transition-all shadow-sm placeholder:text-zinc-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><LinkIcon className="w-3.5 h-3.5 text-zinc-400"/> Reference URLs</Label>
                  <Input />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-zinc-400"/> Reference Image</Label>
                  <button className="w-full h-10 bg-zinc-50 border border-dashed border-zinc-300 hover:border-zinc-400 hover:bg-zinc-100 rounded-md flex items-center justify-center gap-2 text-[13px] font-medium text-zinc-600 transition-colors">
                    <Upload className="w-4 h-4 text-zinc-400" /> Attach file
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button 
                  onClick={() => setReplaceImages(!replaceImages)}
                  className={`w-10 h-5 rounded-full relative transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 ${replaceImages ? "bg-violet-600" : "bg-zinc-200"}`}
                  role="switch"
                  aria-checked={replaceImages}
                >
                  <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${replaceImages ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <span className="text-[13px] font-medium text-zinc-700">Replace images with brand assets</span>
              </div>

              <div className="pt-2 flex justify-end">
                <Button className="bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-600/10">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Page
                </Button>
              </div>

            </div>
          )}

          {mode === "brief" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
              <div className="space-y-2">
                <Label>Target Company or Audience</Label>
                <Input />
              </div>
              <div className="space-y-2">
                <Label>Campaign Objective</Label>
                <Input />
              </div>
              
              <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3 mt-2 flex items-start gap-3">
                <div className="p-1.5 bg-white rounded border border-zinc-200 shadow-sm shrink-0">
                  <BookOpen className="w-4 h-4 text-zinc-600" />
                </div>
                <p className="text-[13px] text-zinc-600 leading-relaxed pt-0.5">
                  Builds a strategic brief detailing audience personas, value props, and recommended sections before you start designing.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/10">
                  Generate Brief
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
