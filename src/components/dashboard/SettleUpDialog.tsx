import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface SettleUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DebtSummary {
  userId: string;
  name: string;
  amount: number;
  groupId: string;
  groupName: string;
}

const SettleUpDialog = ({ open, onOpenChange }: SettleUpDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [debts, setDebts] = useState<DebtSummary[]>([]);
  const [selectedDebt, setSelectedDebt] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    const fetchDebts = async () => {
      setFetching(true);
      try {
        // Get unsettled splits where I owe someone (I'm in the split but didn't pay)
        const { data: splits } = await supabase
          .from("expense_splits")
          .select("amount, expense_id, expenses!inner(paid_by, group_id, groups!inner(name))")
          .eq("user_id", user.id)
          .eq("is_settled", false)
          .neq("expenses.paid_by", user.id) as any;

        if (!splits || splits.length === 0) { setDebts([]); return; }

        // Aggregate debts by payer + group
        const debtMap = new Map<string, DebtSummary>();
        for (const s of splits) {
          const key = `${s.expenses.paid_by}-${s.expenses.group_id}`;
          const existing = debtMap.get(key);
          if (existing) {
            existing.amount += Number(s.amount);
          } else {
            debtMap.set(key, {
              userId: s.expenses.paid_by,
              name: "", // fill below
              amount: Number(s.amount),
              groupId: s.expenses.group_id,
              groupName: s.expenses.groups.name,
            });
          }
        }

        // Fetch payer names
        const payerIds = [...new Set([...debtMap.values()].map((d) => d.userId))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", payerIds);

        const nameMap = new Map<string, string>();
        profiles?.forEach((p) => nameMap.set(p.user_id, p.full_name || p.email || "Unknown"));

        const result = [...debtMap.values()].map((d) => ({
          ...d,
          name: nameMap.get(d.userId) || "Unknown",
        }));

        setDebts(result);
      } finally {
        setFetching(false);
      }
    };
    fetchDebts();
  }, [open, user]);

  const selected = debts.find((d) => `${d.userId}-${d.groupId}` === selectedDebt);

  const handleSettle = async () => {
    if (!user || !selected) return;
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }

    setLoading(true);
    try {
      const { error } = await supabase.from("settlements").insert({
        group_id: selected.groupId,
        paid_by: user.id,
        paid_to: selected.userId,
        amount: amt,
      });
      if (error) throw error;

      // Mark relevant splits as settled
      const { data: splits } = await supabase
        .from("expense_splits")
        .select("id, amount, expense_id, expenses!inner(paid_by, group_id)")
        .eq("user_id", user.id)
        .eq("is_settled", false)
        .eq("expenses.paid_by", selected.userId)
        .eq("expenses.group_id", selected.groupId) as any;

      if (splits) {
        let remaining = amt;
        for (const s of splits) {
          if (remaining <= 0) break;
          if (remaining >= Number(s.amount)) {
            await supabase
              .from("expense_splits")
              .update({ is_settled: true, settled_at: new Date().toISOString() })
              .eq("id", s.id);
            remaining -= Number(s.amount);
          }
        }
      }

      toast.success("Settlement recorded!");
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setSelectedDebt("");
      setSettleAmount("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to settle");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settle Up</DialogTitle>
          <DialogDescription>Record a payment to settle your debts.</DialogDescription>
        </DialogHeader>
        {fetching ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : debts.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">You're all settled up! 🎉</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Who are you paying?</Label>
              <Select value={selectedDebt} onValueChange={(v) => {
                setSelectedDebt(v);
                const d = debts.find((d) => `${d.userId}-${d.groupId}` === v);
                if (d) setSettleAmount(d.amount.toFixed(2));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a person" />
                </SelectTrigger>
                <SelectContent>
                  {debts.map((d) => (
                    <SelectItem key={`${d.userId}-${d.groupId}`} value={`${d.userId}-${d.groupId}`}>
                      {d.name} — ${d.amount.toFixed(2)} ({d.groupName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selected && (
              <div className="space-y-2">
                <Label htmlFor="settle-amount">Amount ($)</Label>
                <Input
                  id="settle-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSettle} disabled={loading || !selected || !settleAmount}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Settle
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SettleUpDialog;
