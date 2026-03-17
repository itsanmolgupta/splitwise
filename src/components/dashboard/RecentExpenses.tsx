import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt } from "lucide-react";
import { motion } from "framer-motion";

interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  expense_date: string;
  group_name: string;
  paid_by_name: string;
  isPaidByMe: boolean;
}

const RecentExpenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchExpenses = async () => {
      // Get groups the user is in
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);

      if (!memberships || memberships.length === 0) {
        setLoading(false);
        return;
      }

      const groupIds = memberships.map((m) => m.group_id);

      const { data: expensesData } = await supabase
        .from("expenses")
        .select("id, title, amount, currency, expense_date, paid_by, group_id, groups(name)")
        .in("group_id", groupIds)
        .order("expense_date", { ascending: false })
        .limit(10);

      if (!expensesData) {
        setLoading(false);
        return;
      }

      // Get payer profiles
      const payerIds = [...new Set(expensesData.map((e) => e.paid_by))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", payerIds);

      const profileMap = new Map(
        profiles?.map((p) => [p.user_id, p.full_name || p.email || "Unknown"]) ?? []
      );

      setExpenses(
        expensesData.map((e: any) => ({
          id: e.id,
          title: e.title,
          amount: Number(e.amount),
          currency: e.currency,
          expense_date: e.expense_date,
          group_name: e.groups?.name ?? "Unknown",
          paid_by_name: profileMap.get(e.paid_by) ?? "Unknown",
          isPaidByMe: e.paid_by === user.id,
        }))
      );
      setLoading(false);
    };

    fetchExpenses();
  }, [user]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Expenses</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="rounded-full bg-muted p-3">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">No expenses yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add an expense to start tracking
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {expenses.map((expense, i) => (
              <motion.div
                key={expense.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <Receipt className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{expense.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {expense.isPaidByMe ? "You" : expense.paid_by_name} paid · {expense.group_name}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">
                    ${expense.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(expense.expense_date)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentExpenses;
