import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import BalanceOverview from "@/components/dashboard/BalanceOverview";
import GroupsList from "@/components/dashboard/GroupsList";
import RecentExpenses from "@/components/dashboard/RecentExpenses";
import QuickActions from "@/components/dashboard/QuickActions";

const DashboardPage = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">SplitWise</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Overview of your shared expenses</p>
        </motion.div>

        {/* Quick Actions */}
        <div className="mb-6">
          <QuickActions />
        </div>

        {/* Balance Cards */}
        <div className="mb-8">
          <BalanceOverview />
        </div>

        {/* Two-column layout: Groups + Recent Expenses */}
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <GroupsList />
          </div>
          <div className="lg:col-span-3">
            <RecentExpenses />
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
