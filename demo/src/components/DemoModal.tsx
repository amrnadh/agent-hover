import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Clock, Check, Sparkles, Building2, User, Mail } from "lucide-react";
import { Button } from "./ui/button";

export const DemoModal: React.FC = () => {
  const { isDemoModalOpen, closeDemoModal, selectedPlan, addToast } = useApp();
  const [step, setStep] = useState<"form" | "confirmed">("form");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    teamSize: "20-100",
    useCase: "Finance & Reconciliation",
    selectedSlot: "Tomorrow, 2:00 PM EST",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableSlots = [
    "Today, 4:30 PM EST",
    "Tomorrow, 10:00 AM EST",
    "Tomorrow, 2:00 PM EST",
    "Thursday, 11:30 AM EST",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setStep("confirmed");
      addToast({
        title: "Demo scheduled successfully!",
        description: `Calendar invite sent to ${formData.email || "your email"}.`,
        type: "success",
      });
    }, 900);
  };

  const handleResetAndClose = () => {
    closeDemoModal();
    setTimeout(() => {
      setStep("form");
    }, 300);
  };

  if (!isDemoModalOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="demo-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm"
        onClick={handleResetAndClose}
      >
        <motion.div
          id="demo-modal-card"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-2xl bg-background border border-border shadow-2xl overflow-hidden font-body text-foreground"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Book a Live Architecture Demo</span>
              <span className="text-[10px] bg-accent/15 text-accent font-medium px-2 py-0.5 rounded-full">
                {selectedPlan} Plan
              </span>
            </div>
            <button
              onClick={handleResetAndClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {step === "form" ? (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Join our enterprise systems architect for a customized 20-minute live demonstration of Nexora agents configured for your stack.
                </p>
              </div>

              {/* Input fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      required
                      type="text"
                      placeholder="Jane Doe"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      required
                      type="email"
                      placeholder="jane@company.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Company Name
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      required
                      type="text"
                      placeholder="Acme Corp"
                      value={formData.company}
                      onChange={(e) =>
                        setFormData({ ...formData, company: e.target.value })
                      }
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Team Size
                  </label>
                  <select
                    value={formData.teamSize}
                    onChange={(e) =>
                      setFormData({ ...formData, teamSize: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-secondary/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="1-20">1 - 20 employees</option>
                    <option value="20-100">20 - 100 employees</option>
                    <option value="100-500">100 - 500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1.5">
                  Select a convenient slot
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, selectedSlot: slot })
                      }
                      className={`text-left p-2.5 rounded-lg border text-xs transition-all flex items-center gap-2 ${
                        formData.selectedSlot === slot
                          ? "border-accent bg-accent/5 text-foreground font-medium ring-1 ring-accent"
                          : "border-border bg-secondary/20 text-muted-foreground hover:border-border hover:bg-secondary/40"
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5 text-accent shrink-0" />
                      <span className="truncate">{slot}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResetAndClose}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full px-5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                      Reserving Slot...
                    </span>
                  ) : (
                    "Confirm Demo Reservation"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="p-8 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <Check className="h-6 w-6 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Demo Reserved with Nexora!
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
                  We've locked in <span className="font-semibold text-foreground">{formData.selectedSlot}</span> for {formData.name || "you"}. Check your inbox for calendar credentials and preparation notes.
                </p>
              </div>
              <div className="pt-3">
                <Button
                  onClick={handleResetAndClose}
                  className="rounded-full px-6 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Return to Exploration
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
