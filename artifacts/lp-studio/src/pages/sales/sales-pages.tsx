import { FileText, Plus } from "lucide-react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SalesLayout } from "@/components/layout/sales-layout";

export default function SalesPages() {
  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Microsites</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Personalized landing pages built for specific accounts
            </p>
          </div>
          <Link href="/pages/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Microsite
            </Button>
          </Link>
        </div>

        <Card className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border border-dashed border-border text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-display font-bold text-foreground mb-2">
            No microsites yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Create a personalized microsite for a target account using the page builder.
            Microsites are LP Studio pages tagged to a specific account for tracked outreach.
          </p>
          <Link href="/pages/new" className="mt-4">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Microsite
            </Button>
          </Link>
        </Card>
      </div>
    </SalesLayout>
  );
}
