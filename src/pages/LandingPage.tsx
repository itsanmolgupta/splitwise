import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Receipt, Users, Wallet, PieChart, Shield, Zap } from "lucide-react";
import { motion, type Easing } from "framer-motion";

const features = [
  {
    icon: Receipt,
    title: "Track Expenses",
    description: "Log every expense in seconds. Categorize, tag, and attach receipts effortlessly.",
  },
  {
    icon: Users,
    title: "Split Fairly",
    description: "Split bills equally, by percentage, or custom amounts. Everyone pays their share.",
  },
  {
    icon: Wallet,
    title: "Settle Up",
    description: "See who owes whom and settle debts with one tap. Keep friendships intact.",
  },
  {
    icon: PieChart,
    title: "Visual Insights",
    description: "Beautiful charts show where your money goes. Understand spending at a glance.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Bank-level encryption keeps your financial data safe and private.",
  },
  {
    icon: Zap,
    title: "Real-time Sync",
    description: "Changes reflect instantly across all devices. Everyone stays up to date.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">SplitWise</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-[var(--gradient-hero)]" />
        <div className="relative container mx-auto px-4 py-24 md:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="mb-4 inline-block rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                Split expenses, not friendships ✨
              </span>
            </motion.div>
            <motion.h1
              className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl lg:text-7xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Track, Split &{" "}
              <span className="bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
                Settle
              </span>{" "}
              Expenses Together
            </motion.h1>
            <motion.p
              className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground md:text-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              The easiest way to share expenses with friends, roommates, and groups. No more awkward money conversations.
            </motion.p>
            <motion.div
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Button variant="hero" size="xl" asChild>
                <Link to="/signup">
                  Start for Free <ArrowRight className="ml-1 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="hero-outline" size="xl" asChild>
                <Link to="/login">I have an account</Link>
              </Button>
            </motion.div>
          </div>

          {/* Floating cards decoration */}
          <motion.div
            className="mx-auto mt-16 max-w-4xl"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="h-3 w-3 rounded-full bg-destructive" />
                <div className="h-3 w-3 rounded-full bg-warning" />
                <div className="h-3 w-3 rounded-full bg-success" />
                <span className="ml-2 text-sm text-muted-foreground">Dashboard Preview</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-success/10 p-4">
                  <p className="text-sm text-muted-foreground">You are owed</p>
                  <p className="mt-1 font-display text-2xl font-bold text-success">$245.50</p>
                </div>
                <div className="rounded-xl bg-destructive/10 p-4">
                  <p className="text-sm text-muted-foreground">You owe</p>
                  <p className="mt-1 font-display text-2xl font-bold text-destructive">$82.30</p>
                </div>
                <div className="rounded-xl bg-info/10 p-4">
                  <p className="text-sm text-muted-foreground">Total balance</p>
                  <p className="mt-1 font-display text-2xl font-bold text-info">$163.20</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <motion.div
            className="mx-auto max-w-2xl text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">
              Everything you need to manage shared expenses
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Powerful features wrapped in a simple, beautiful interface.
            </p>
          </motion.div>
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="group rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-md"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <motion.div
            className="mx-auto max-w-3xl rounded-3xl bg-primary p-12 text-center shadow-primary md:p-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">
              Ready to simplify your expenses?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-primary-foreground/80">
              Join thousands of people who use SplitWise to manage shared expenses. It's free to get started.
            </p>
            <Button variant="hero-outline" size="xl" className="mt-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link to="/signup">
                Create Free Account <ArrowRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Wallet className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-bold text-foreground">SplitWise</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 SplitWise. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
