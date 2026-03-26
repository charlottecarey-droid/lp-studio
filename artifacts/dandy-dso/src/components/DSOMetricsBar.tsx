import { motion } from "framer-motion";

const metrics = [
  { value: "30%", label: "Avg case acceptance lift" },
  { value: "96%", label: "First-time right rate" },
  { value: "50%", label: "Denture appointments saved" },
  { value: "$0", label: "CAPEX to get started" },
];

const DSOMetricsBar = () => (
  <section className="bg-background">
    <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-10 md:py-14">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className="text-center"
          >
            <p className="text-3xl md:text-4xl font-medium text-foreground tracking-tight">{m.value}</p>
            <p className="text-sm text-muted-foreground mt-1.5">{m.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default DSOMetricsBar;
