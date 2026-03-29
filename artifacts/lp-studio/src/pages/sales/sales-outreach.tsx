import { Mail, Send, FileText, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SalesLayout } from "@/components/layout/sales-layout";

export default function SalesOutreach() {
  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Outreach</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage email campaigns with tracked microsites
          </p>
        </div>

        {/* Tabs placeholder */}
        <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5 w-fit">
          {["Single Send", "Campaigns", "Templates"].map((tab, i) => (
            <button
              key={tab}
              className={`px-4 py-2 rounded-md text-xs font-semibold transition-all ${
                i === 0
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Coming Soon */}
        <Card className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border border-dashed border-border text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-display font-bold text-foreground mb-2">
            Outreach Coming in Phase 2
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            AI-powered email generation, merge variables, microsite links, and tracked campaigns.
            Build your accounts and contacts first — outreach is next.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Send className="w-3.5 h-3.5" /> Single Send
            </div>
            <span className="text-muted-foreground/30">·</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="w-3.5 h-3.5" /> Templates
            </div>
            <span className="text-muted-foreground/30">·</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BarChart3 className="w-3.5 h-3.5" /> Campaign Analytics
            </div>
          </div>
        </Card>
      </div>
    </SalesLayout>
  );
}
