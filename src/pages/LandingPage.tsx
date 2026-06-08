import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Users, Shield, ClipboardCheck, Award, BarChart3, Zap,
  ArrowRight, GraduationCap, Stethoscope, Menu, X
} from "lucide-react";
import { useState } from "react";
import heroBg from "@/assets/hero-bg.jpg";

const features = [
  {
    icon: Users,
    title: "Multi-Role Dashboards",
    description: "Six tailored dashboards for Admin, Core Team, Staff, Students, Judges, and Volunteers.",
  },
  {
    icon: ClipboardCheck,
    title: "Automated Workflows",
    description: "From registration to certificates — every step automated and tracked in real-time.",
  },
  {
    icon: Shield,
    title: "Secure & Role-Based",
    description: "Granular access control ensures each user sees only what's relevant to their role.",
  },
  {
    icon: Award,
    title: "Digital Evaluation",
    description: "Structured scoring, automatic ranking, and intelligent tie-breaking for fair results.",
  },
  {
    icon: BarChart3,
    title: "Live Analytics",
    description: "Real-time dashboards with registration stats, payments, attendance, and session progress.",
  },
  {
    icon: Zap,
    title: "Instant Certificates",
    description: "Auto-generated, personalized certificates delivered via email post-event.",
  },
];

const stats = [
  { value: "800+", label: "Students per Event" },
  { value: "40+", label: "Participating Colleges" },
  { value: "60+", label: "Expert Judges" },
  { value: "80%", label: "Time Saved" },
];

import { useProgram } from "@/contexts/ProgramContext";

export default function LandingPage() {
  const navigate = useNavigate();
  const { currentProgram } = useProgram();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isIcon = currentProgram === 'ICON';

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">
              {isIcon ? "Madras ICON" : "MIDAS"}
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#stats" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Impact</a>
            <a href="#roles" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Roles</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/member-login")}>Member Login</Button>
            <Button variant="hero" size="sm" onClick={() => navigate("/student-registration")}>
              {isIcon ? "Delegate Registration" : "Event Registration"}
            </Button>
          </div>

          <button className="md:hidden text-foreground" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden glass border-t border-border px-4 py-4 space-y-3">
            <a href="#features" className="block text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#stats" className="block text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Impact</a>
            <a href="#roles" className="block text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Roles</a>
            <div className="pt-2 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate("/member-login")}>Member Login</Button>
              <Button variant="hero" size="sm" className="flex-1" onClick={() => navigate("/student-registration")}>Registration</Button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: `url(${heroBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

        <div className="container mx-auto px-4 relative z-10 pt-24">
          <motion.div
            className="max-w-3xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 mb-6">
              <GraduationCap className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-primary">Scientific Event Management</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="text-primary-foreground">
                {isIcon ? "Empowering Clinicians " : "Manage dental symposiums "}
              </span>
              <span className="text-gradient-primary">with precision</span>
            </h1>
            <p className="text-lg text-primary-foreground/70 max-w-xl mb-8 leading-relaxed">
              {isIcon 
                ? "Madras ICON is the premier platform for postgraduates and academicians to showcase research, engage in peer review, and elevate scientific standards."
                : "MIDAS digitizes the complete lifecycle of inter-college dental scientific events — from registration to certificates, all in one platform."
              }
            </p>
            <div className="flex flex-wrap gap-4">
              <Button variant="hero" size="xl" onClick={() => navigate("/member-login")}>
                Member Login <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="outline-hero" size="xl" onClick={() => navigate("/student-registration")} className="border-primary-foreground/50 text-primary-foreground hover:bg-white/10">
                {isIcon ? "Professional Registration" : "UG Delegate Registration"}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="py-16 border-b border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="font-display text-3xl md:text-4xl font-bold text-gradient-primary mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">Everything you need</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              A complete platform replacing spreadsheets, emails, and paper forms with automated, intelligent workflows.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="group p-6 rounded-xl bg-card border border-border hover:shadow-elevated hover:border-primary/20 transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="py-24 bg-secondary/50">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">Built for every stakeholder</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Six dedicated dashboards designed for each role in the event lifecycle.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { role: "Admin", desc: "Full system control, analytics, and master data management.", color: "bg-primary/10 text-primary" },
              { role: "Core Team", desc: "Session planning, judge allocation, and event monitoring.", color: "bg-accent/20 text-accent-foreground" },
              { role: "Staff Coordinator", desc: "Verify registrations and scrutinize abstracts for your college.", color: "bg-primary/10 text-primary" },
              { role: "Delegate", desc: "Register, pay, submit research, and receive certificates.", color: "bg-accent/20 text-accent-foreground" },
              { role: "Judge", desc: "Evaluate presentations with structured digital scoring.", color: "bg-primary/10 text-primary" },
              { role: "Volunteer", desc: "Manage attendance and presentations on the ground.", color: "bg-accent/20 text-accent-foreground" },
            ].map((item, i) => (
              <motion.div
                key={item.role}
                className="p-5 rounded-xl bg-card border border-border hover:shadow-card transition-all"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <div className={`inline-block px-3 py-1 rounded-md text-xs font-semibold mb-3 ${item.color}`}>{item.role}</div>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">Ready to modernize your events?</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Start managing scientific symposiums with the efficiency they deserve.
            </p>
            <Button variant="hero" size="xl" onClick={() => navigate("/member-login")}>
              Get Started Now <ArrowRight className="w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-primary flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display text-sm font-semibold text-foreground">
              {isIcon ? "Madras ICON" : "MIDAS"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 {isIcon ? "Madras ICON" : "MIDAS"}. Scientific Event Management System.</p>
        </div>
      </footer>
    </div>
  );
}
