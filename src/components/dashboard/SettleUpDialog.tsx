import { useState, useEffect, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface SettleUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UnsettledSplit {
  splitId: string;
  expenseId: string;
  expenseTitle: string;
  expenseDate: string;
  amount: number;
  payerId: string;
  payerName: string;
  groupId: string;
  groupName: string;
}

const SettleUpDialog = ({ open, onOpenChange }: SettleUpDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [splits, setSplits] = useState<UnsettledSplit[]>([]);
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedSplitIds, setSelectedSplitIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    const fetchSplits = async () => {
      setFetching(true);
      try {
        // Get all unsettled splits where I owe someone
        const { data: rawSplits } = await supabase
          .from("expense_splits")
          .select("id, amount, expense_id, expenses!inner(id, title, expense_date, paid_by, group_id, groups!inner(name))")
          .eq("user_id", user.id)
          .eq("is_settled", false)
          .neq("expenses.paid_by", user.id) as any;

        if (!rawSplits || rawSplits.length === 0) {
          setSplits([]);
          return;
        }

        // Get payer names
        const payerIds = [...new Set(rawSplits.map((s: any) => s.expenses.paid_by))] as string[];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", payerIds);

        const nameMap = new Map<string, string>();
        profiles?.forEach((p) => nameMap.set(p.user_id, p.full_name || p.email || "Unknown"));

        const result: UnsettledSplit[] = rawSplits.map((s: any) => ({
          splitId: s.id,
          expenseId: s.expenses.id,
          expenseTitle: s.expenses.title,
          expenseDate: s.expenses.expense_date,
          amount: Number(s.amount),
          payerId: s.expenses.paid_by,
          payerName: nameMap.get(s.expenses.paid_by) || "Unknown",
          groupId: s.expenses.group_id,
          groupName: s.expenses.groups.name,
        }));

        setSplits(result);
      } finally {
        setFetching(false);
      }
    };
    fetchSplits();
    setSelectedSplitIds(new Set());
    setSelectedUser("all");
  }, [open, user]);

  // Unique payers for filter
  const payers = useMemo(() => {
    const map = new Map<string, string>();
    splits.forEach((s) => map.set(s.payerId, s.payerName));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [splits]);

  // Filtered splits
  const filtered = useMemo(
    () => (selectedUser === "all" ? splits : splits.filter((s) => s.payerId === selectedUser)),
    [splits, selectedUser]
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selectedSplitIds.has(s.splitId));

  const toggleSplit = (id: string) => {
    setSelectedSplitIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedSplitIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((s) => next.delete(s.splitId));
        return next;
      });
    } else {
      setSelectedSplitIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((s) => next.add(s.splitId));
        return next;
      });
    }
  };

  const selectedTotal = useMemo(
    () => splits.filter((s) => selectedSplitIds.has(s.splitId)).reduce((sum, s) => sum + s.amount, 0),
    [splits, selectedSplitIds]
  );

  const handleSettle = async () => {
    if (!user || selectedSplitIds.size === 0) return;
    setLoading(true);
    try {
      const toSettle = splits.filter((s) => selectedSplitIds.has(s.splitId));

      // Group by payer+group for settlement records
      const settlementMap = new Map<string, { groupId: string; payerId: string; amount: number }>();
      for (const s of toSettle) {
        const key = `${s.payerId}-${s.groupId}`;
        const existing = settlementMap.get(key);
        if (existing) {
          existing.amount += s.amount;
        } else {
          settlementMap.set(key, { groupId: s.groupId, payerId: s.payerId, amount: s.amount });
        }
      }

      // Insert settlement records
      for (const entry of settlementMap.values()) {
        const { error } = await supabase.from("settlements").insert({
          group_id: entry.groupId,
          paid_by: user.id,
          paid_to: entry.payerId,
          amount: entry.amount,
        });
        if (error) throw error;
      }

      // Mark splits as settled
      const splitIds = toSettle.map((s) => s.splitId);
      const { error: updateError } = await supabase
        .from("expense_splits")
        .update({ is_settled: true, settled_at: new Date().toISOString() })
        .in("id", splitIds);
      if (updateError) throw updateError;

      toast.success(`Settled ${toSettle.length} expense${toSettle.length > 1 ? "s" : ""}!`);
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setSelectedSplitIds(new Set());
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to settle");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Settle Up</DialogTitle>
          <DialogDescription>Select the expenses you want to settle.</DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : splits.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <p className="text-muted-foreground font-medium">You're all settled up! 🎉</p>
          </div>
        ) : (
          <>
            {/* Filter by user */}
            <div className="space-y-1.5">
              <Select value={selectedUser} onValueChange={(v) => { setSelectedUser(v); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All people</SelectItem>
                  {payers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Select all */}
            <div className="flex items-center justify-between border-b border-border pb-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground">
                <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} />
                Select all ({filtered.length})
              </label>
              {selectedSplitIds.size > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedSplitIds.size} selected · ${selectedTotal.toFixed(2)}
                </Badge>
              )}
            </div>

            {/* Splits list */}
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[40vh] pr-1">
              {filtered.map((s) => {
                const checked = selectedSplitIds.has(s.splitId);
                return (
                  <label
                    key={s.splitId}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      checked
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleSplit(s.splitId)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{s.expenseTitle}</span>
                        <span className="text-sm font-semibold text-destructive whitespace-nowrap">
                          ${s.amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>Paid by {s.payerName}</span>
                        <span>·</span>
                        <span>{s.groupName}</span>
                        <span>·</span>
                        <span>{format(new Date(s.expenseDate), "MMM d")}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSettle} disabled={loading || selectedSplitIds.size === 0}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Settle ${selectedTotal.toFixed(2)}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SettleUpDialog;
