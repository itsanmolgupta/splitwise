import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import { motion } from "framer-motion";

interface BalanceData {
  youOwe: number;
  owedToYou: number;
  netBalance: number;
}

const BalanceOverview = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<BalanceData>({ youOwe: 0, owedToYou: 0, netBalance: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchBalances = async () => {
      // Get all unsettled splits where current user owes
      const { data: myDebts } = await supabase
        .from("expense_splits")
        .select("amount, expense_id, expenses(paid_by)")
        .eq("user_id", user.id)
        .eq("is_settled", false);

      // Get all unsettled splits on expenses the user paid for
      const { data: myExpenses } = await supabase
        .from("expenses")
        .select("id")
        .eq("paid_by", user.id);

      const myExpenseIds = myExpenses?.map((e) => e.id) ?? [];

      let owedToYou = 0;
      if (myExpenseIds.length > 0) {
        const { data: othersDebts } = await supabase
          .from("expense_splits")
          .select("amount")
          .in("expense_id", myExpenseIds)
          .neq("user_id", user.id)
          .eq("is_settled", false);
        owedToYou = othersDebts?.reduce((sum, s) => sum + Number(s.amount), 0) ?? 0;
      }

      // What I owe = splits assigned to me on expenses NOT paid by me
      const youOwe =
        myDebts
          ?.filter((d: any) => d.expenses?.paid_by !== user.id)
          .reduce((sum, s) => sum + Number(s.amount), 0) ?? 0;

      setBalance({ youOwe, owedToYou, netBalance: owedToYou - youOwe });
      setLoading(false);
    };

    fetchBalances();
  }, [user]);

  const cards = [
    {
      title: "You owe",
      value: balance.youOwe,
      icon: TrendingDown,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      title: "Owed to you",
      value: balance.owedToYou,
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Net balance",
      value: balance.netBalance,
      icon: Scale,
      color: balance.netBalance >= 0 ? "text-primary" : "text-destructive",
      bg: balance.netBalance >= 0 ? "bg-primary/10" : "bg-destructive/10",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-24 animate-pulse rounded bg-muted" />
              ) : (
                <p className={`font-display text-2xl font-bold ${card.color}`}>
                  {card.value < 0 ? "-" : ""}${Math.abs(card.value).toFixed(2)}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default BalanceOverview;
