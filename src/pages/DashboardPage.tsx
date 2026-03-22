import { motion } from "framer-motion";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import BalanceOverview from "@/components/dashboard/BalanceOverview";
import GroupsList from "@/components/dashboard/GroupsList";
import RecentExpenses from "@/components/dashboard/RecentExpenses";
import QuickActions from "@/components/dashboard/QuickActions";

const DashboardPage = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-30 h-12 flex items-center border-b border-border bg-card/80 backdrop-blur-md px-4">
            <SidebarTrigger />
          </header>

          <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-6"
            >
              <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="mt-1 text-muted-foreground">Overview of your shared expenses</p>
            </motion.div>

            <div className="mb-6">
              <QuickActions />
            </div>

            <div className="mb-8">
              <BalanceOverview />
            </div>

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
      </div>
    </SidebarProvider>
  );
};

export default DashboardPage;
