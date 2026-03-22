import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface BalanceDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "owe" | "owed";
}

interface TransactionItem {
  splitId: string;
  expenseTitle: string;
  expenseDate: string;
  amount: number;
  otherUserId: string;
  otherUserName: string;
  groupName: string;
}

const BalanceDetailsDialog = ({ open, onOpenChange, type }: BalanceDetailsDialogProps) => {
  const { user } = useAuth();
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;

    const fetch = async () => {
      setLoading(true);
      try {
        if (type === "owe") {
          // Splits assigned to me on expenses NOT paid by me
          const { data } = await supabase
            .from("expense_splits")
            .select("id, amount, expenses!inner(title, expense_date, paid_by, group_id, groups!inner(name))")
            .eq("user_id", user.id)
            .eq("is_settled", false)
            .neq("expenses.paid_by", user.id) as any;

          if (!data || data.length === 0) { setItems([]); return; }

          const payerIds = [...new Set(data.map((s: any) => s.expenses.paid_by))] as string[];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", payerIds);

          const nameMap = new Map<string, string>();
          profiles?.forEach((p) => nameMap.set(p.user_id, p.full_name || p.email || "Unknown"));

          setItems(data.map((s: any) => ({
            splitId: s.id,
            expenseTitle: s.expenses.title,
            expenseDate: s.expenses.expense_date,
            amount: Number(s.amount),
            otherUserId: s.expenses.paid_by,
            otherUserName: nameMap.get(s.expenses.paid_by) || "Unknown",
            groupName: s.expenses.groups.name,
          })));
        } else {
          // Splits on my expenses assigned to others
          const { data } = await supabase
            .from("expense_splits")
            .select("id, amount, user_id, expenses!inner(title, expense_date, paid_by, group_id, groups!inner(name))")
            .eq("expenses.paid_by", user.id)
            .neq("user_id", user.id)
            .eq("is_settled", false) as any;

          if (!data || data.length === 0) { setItems([]); return; }

          const userIds = [...new Set(data.map((s: any) => s.user_id))] as string[];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", userIds);

          const nameMap = new Map<string, string>();
          profiles?.forEach((p) => nameMap.set(p.user_id, p.full_name || p.email || "Unknown"));

          setItems(data.map((s: any) => ({
            splitId: s.id,
            expenseTitle: s.expenses.title,
            expenseDate: s.expenses.expense_date,
            amount: Number(s.amount),
            otherUserId: s.user_id,
            otherUserName: nameMap.get(s.user_id) || "Unknown",
            groupName: s.expenses.groups.name,
          })));
        }
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [open, user, type]);

  const total = items.reduce((sum, i) => sum + i.amount, 0);
  const isOwe = type === "owe";
  const Icon = isOwe ? TrendingDown : TrendingUp;

  // Group by person
  const grouped = items.reduce<Record<string, TransactionItem[]>>((acc, item) => {
    const key = item.otherUserId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${isOwe ? "text-destructive" : "text-primary"}`} />
            {isOwe ? "You Owe" : "Owed to You"}
          </DialogTitle>
          <DialogDescription>
            {isOwe
              ? "Unsettled expenses you need to pay"
              : "Unsettled expenses others owe you"}
            {" · "}
            <span className={`font-semibold ${isOwe ? "text-destructive" : "text-primary"}`}>
              ${total.toFixed(2)}
            </span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <p className="font-medium">
              {isOwe ? "You don't owe anything! 🎉" : "No one owes you anything."}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 min-h-0 max-h-[55vh] pr-1">
            {Object.entries(grouped).map(([userId, txns]) => {
              const personTotal = txns.reduce((s, t) => s + t.amount, 0);
              return (
                <div key={userId} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      {isOwe ? `To ${txns[0].otherUserName}` : txns[0].otherUserName}
                    </span>
                    <Badge variant={isOwe ? "destructive" : "default"} className="text-xs">
                      ${personTotal.toFixed(2)}
                    </Badge>
                  </div>
                  {txns.map((t) => (
                    <div
                      key={t.splitId}
                      className="flex items-center justify-between rounded-lg border border-border p-3 bg-card"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-foreground">{t.expenseTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.groupName} · {format(new Date(t.expenseDate), "MMM d, yyyy")}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold whitespace-nowrap ml-3 ${isOwe ? "text-destructive" : "text-primary"}`}>
                        ${t.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BalanceDetailsDialog;
