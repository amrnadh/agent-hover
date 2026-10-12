import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, Plus, ExternalLink, ShieldCheck, Zap } from "lucide-react";
import { Button } from "./ui/button";
import { useApp } from "../context/AppContext";
import {
  staggerContainerVariants,
  staggerItemVariants,
} from "./ui/ScrollReveal";

interface IntegrationItem {
  id: string;
  name: string;
  category: "Banking & Capital" | "Cloud & Infrastructure" | "Productivity & ERP" | "DevOps";
  description: string;
  connected: boolean;
  latency: string;
}

export const Integrations: React.FC = () => {
  const { addToast } = useApp();
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [items, setItems] = useState<IntegrationItem[]>([
    {
      id: "mercury",
      name: "Harbor",
      category: "Banking & Capital",
      description: "Bi-directional wire & ACH reconciliation with real-time treasury sweeps.",
      connected: true,
      latency: "120ms",
    },
    {
      id: "aws",
      name: "Cloud Billing & Metrics",
      category: "Cloud & Infrastructure",
      description: "Automated cost anomaly monitoring and monthly infrastructure invoice audit.",
      connected: true,
      latency: "95ms",
    },
    {
      id: "stripe",
      name: "Payflow",
      category: "Banking & Capital",
      description: "Payout tracking, fee reconciliation, and disputes auto-handling.",
      connected: true,
      latency: "80ms",
    },
    {
      id: "ramp",
      name: "Spendly",
      category: "Banking & Capital",
      description: "Corporate card receipt matching, spend limits enforcement, and travel approvals.",
      connected: false,
      latency: "140ms",
    },
    {
      id: "linear",
      name: "Trackline",
      category: "DevOps",
      description: "Bi-directional issue triaging, cycle budget allocation, and release logs.",
      connected: true,
      latency: "60ms",
    },
    {
      id: "slack",
      name: "Teamchat",
      category: "Productivity & ERP",
      description: "Interactive dual-key signoff buttons and executive escalation alerts.",
      connected: true,
      latency: "45ms",
    },
    {
      id: "quickbooks",
      name: "Ledgerly",
      category: "Productivity & ERP",
      description: "Zero-touch general ledger posting with automated tax categorization.",
      connected: false,
      latency: "210ms",
    },
    {
      id: "github",
      name: "Gitforge",
      category: "DevOps",
      description: "Repository secret rotation, automated PR patching, and CI/CD cost checks.",
      connected: false,
      latency: "110ms",
    },
    {
      id: "salesforce",
      name: "Pipeline CRM",
      category: "Productivity & ERP",
      description: "Closed-won contract invoice generation and ARR expansion sync.",
      connected: false,
      latency: "180ms",
    },
    {
      id: "gusto",
      name: "Paystream",
      category: "Productivity & ERP",
      description: "Payroll ledger validation and benefits deduction cross-referencing.",
      connected: true,
      latency: "150ms",
    },
    {
      id: "datadog",
      name: "Watchtower",
      category: "Cloud & Infrastructure",
      description: "Telemetry ingestion for real-time agent execution health and trace spans.",
      connected: false,
      latency: "75ms",
    },
    {
      id: "brex",
      name: "Cardinal",
      category: "Banking & Capital",
      description: "Global credit line balancing and multi-currency treasury deposits.",
      connected: false,
      latency: "130ms",
    },
  ]);

  const toggleConnect = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextState = !item.connected;
          addToast({
            title: nextState
              ? `${item.name} Connected`
              : `${item.name} Disconnected`,
            description: nextState
              ? "OAuth handshake confirmed with TLS 1.3 encryption."
              : "API tokens revoked safely.",
            type: nextState ? "success" : "info",
          });
          return { ...item, connected: nextState };
        }
        return item;
      })
    );
  };

  const categories = [
    "All",
    "Banking & Capital",
    "Cloud & Infrastructure",
    "Productivity & ERP",
    "DevOps",
  ];

  const filtered = items.filter((item) => {
    const matchesCategory =
      activeCategory === "All" || item.category === activeCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <motion.section
      id="integrations"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="w-full py-20 px-6 md:px-12 lg:px-20 font-body bg-background"
    >
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -50px 0px" }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
              Ecosystem Connectivity
            </div>
            <h2 className="font-display text-3xl md:text-5xl tracking-tight text-foreground leading-tight">
              Native integration with <span className="italic">every</span> tool in your financial stack.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connect in under 60 seconds with pre-configured API connectors, least-privilege scopes, and webhook listeners.
            </p>
          </div>

          {/* Search bar */}
          <div className="w-full md:w-72 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search 100+ connectors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-1 focus:ring-ring font-body"
            />
          </div>
        </motion.div>

        {/* Category Pills */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -40px 0px" }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="flex items-center gap-2 overflow-x-auto pb-1"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Integrations Grid */}
        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "0px 0px -40px 0px" }}
          custom={{ stagger: 0.05 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtered.map((item) => (
            <motion.div
              key={item.id}
              variants={staggerItemVariants}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="p-5 rounded-xl bg-background border border-border shadow-2xs hover:border-border/80 transition-all flex flex-col justify-between gap-4 group hover:shadow-md"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                    {item.latency}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {item.category}
                </span>

                <button
                  onClick={() => toggleConnect(item.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    item.connected
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                      : "bg-secondary text-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {item.connected ? (
                    <>
                      <Check className="h-3 w-3 stroke-[2.5]" />
                      <span>Connected</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" />
                      <span>Connect</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
};
