import { Link } from "wouter";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { 
  Plus, 
  ArrowUpRight, 
  BarChart3, 
  MousePointerClick, 
  Eye, 
  Beaker
} from "lucide-react";

import { useListTests } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { AppLayout } from "@/components/layout/app-layout";

export default function Dashboard() {
  const { data: tests, isLoading } = useListTests();

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 pb-10">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Experiments</h1>
            <p className="text-muted-foreground mt-2 text-lg">Manage your A/B and multivariate tests.</p>
          </div>
          <Link href="/tests/new">
            <Button size="lg" className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5 rounded-xl font-semibold px-6">
              <Plus className="w-5 h-5 mr-2" />
              New Experiment
            </Button>
          </Link>
        </div>

        {/* Empty State / Loading / Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-[280px] rounded-2xl" />
            ))}
          </div>
        ) : tests?.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center text-center p-16 bg-card/50 border border-dashed border-border rounded-3xl"
          >
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
              <Beaker className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-display font-bold mb-2">No experiments yet</h3>
            <p className="text-muted-foreground max-w-md mb-8">
              Create your first A/B test to start optimizing your landing page conversions.
            </p>
            <Link href="/tests/new">
              <Button variant="default" size="lg" className="rounded-xl">
                Create your first test
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tests?.map((test, i) => (
              <motion.div
                key={test.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/tests/${test.id}`}>
                  <Card className="group relative h-full flex flex-col p-6 rounded-2xl hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-pointer overflow-hidden bg-card/80 backdrop-blur-sm">
                    
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-4">
                      <StatusBadge status={test.status} />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
                        <ArrowUpRight className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Title */}
                    <div className="mb-6">
                      <h3 className="font-display font-bold text-xl line-clamp-1 mb-1 group-hover:text-primary transition-colors">
                        {test.name}
                      </h3>
                      <p className="text-sm text-muted-foreground font-mono">
                        /lp/{test.slug}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="mt-auto grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                          <Beaker className="w-3 h-3" /> Variants
                        </div>
                        <p className="text-lg font-bold text-foreground">
                          {test.variantCount || 0}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                          <BarChart3 className="w-3 h-3" /> Type
                        </div>
                        <p className="text-sm font-bold text-foreground mt-1 capitalize">
                          {test.testType}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 text-xs text-muted-foreground flex items-center justify-between">
                      <span>Updated {format(new Date(test.updatedAt), 'MMM d, yyyy')}</span>
                    </div>

                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
