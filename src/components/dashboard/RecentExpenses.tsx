import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, ArrowRight, Users, CreditCard } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface SplitDetail {
  user_id: string;
  amount: number;
  percentage: number | null;
  is_settled: boolean;
  user_name: string;
}

interface ActivityItem {
  id: string;
  title: string;
  amount: number;
  currency: string;
  expense_date: string;
  split_type: string;
  group_name: string;
  paid_by_name: string;
  paid_by_id: string;
  isPaidByMe: boolean;
  splits: SplitDetail[];
}

const RecentExpenses = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchActivities = async () => {
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
        .select("id, title, amount, currency, expense_date, paid_by, group_id, split_type, groups(name)")
        .in("group_id", groupIds)
        .order("expense_date", { ascending: false })
        .limit(10);

      if (!expensesData || expensesData.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch splits for all expenses
      const expenseIds = expensesData.map((e) => e.id);
      const { data: splitsData } = await supabase
        .from("expense_splits")
        .select("expense_id, user_id, amount, percentage, is_settled")
        .in("expense_id", expenseIds);

      // Collect all user IDs (payers + split participants)
      const allUserIds = new Set<string>();
      expensesData.forEach((e) => allUserIds.add(e.paid_by));
      splitsData?.forEach((s) => allUserIds.add(s.user_id));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", [...allUserIds]);

      const profileMap = new Map(
        profiles?.map((p) => [p.user_id, p.full_name || p.email || "Unknown"]) ?? []
      );

      const getName = (uid: string) =>
        uid === user.id ? "You" : (profileMap.get(uid) ?? "Unknown");

      setActivities(
        expensesData.map((e: any) => ({
          id: e.id,
          title: e.title,
          amount: Number(e.amount),
          currency: e.currency,
          expense_date: e.expense_date,
          split_type: e.split_type,
          group_name: e.groups?.name ?? "Unknown",
          paid_by_name: getName(e.paid_by),
          paid_by_id: e.paid_by,
          isPaidByMe: e.paid_by === user.id,
          splits: (splitsData ?? [])
            .filter((s) => s.expense_id === e.id)
            .map((s) => ({
              user_id: s.user_id,
              amount: Number(s.amount),
              percentage: s.percentage ? Number(s.percentage) : null,
              is_settled: s.is_settled,
              user_name: getName(s.user_id),
            })),
        }))
      );
      setLoading(false);
    };

    fetchActivities();
  }, [user]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const splitTypeLabel = (type: string) => {
    switch (type) {
      case "percentage": return "% Split";
      case "custom": return "Custom";
      default: return "Equal";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  </div>
                </div>
                <div className="h-10 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="rounded-full bg-muted p-3">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">No activity yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add an expense to start tracking
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity, i) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-lg border border-border p-3 transition-shadow hover:shadow-md"
              >
                {/* Header row */}
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <CreditCard className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {activity.title}
                      </p>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                        {splitTypeLabel(activity.split_type)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium text-foreground">{activity.paid_by_name}</span>
                      {" paid "}
                      <span className="font-semibold text-foreground">
                        ${activity.amount.toFixed(2)}
                      </span>
                      {" · "}
                      {activity.group_name}
                      {" · "}
                      {formatDate(activity.expense_date)}
                    </p>
                  </div>
                </div>

                {/* Split breakdown */}
                {activity.splits.length > 0 && (
                  <div className="mt-2 ml-12 space-y-1">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                      <Users className="h-3 w-3" />
                      <span>Split between {activity.splits.length} {activity.splits.length === 1 ? "person" : "people"}</span>
                    </div>
                    {activity.splits.map((split) => (
                      <div
                        key={split.user_id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-foreground font-medium truncate">
                          {split.user_name}
                        </span>
                        <span className="text-muted-foreground">
                          owes ${split.amount.toFixed(2)}
                          {split.percentage != null && (
                            <span className="ml-1">({split.percentage.toFixed(0)}%)</span>
                          )}
                        </span>
                        {split.is_settled && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-200 bg-green-50">
                            Settled
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentExpenses;
