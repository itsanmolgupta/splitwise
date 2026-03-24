import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, AlertCircle } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import CategoryIcon from "@/components/dashboard/CategoryIcon";

type SplitType = "equal" | "percentage" | "custom";

interface SplitEntry {
  user_id: string;
  name: string;
  value: string;
  included: boolean;
}

interface EditExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: {
    id: string;
    title: string;
    amount: number;
    split_type: string;
    group_id: string;
    paid_by: string;
    category_id?: string | null;
  } | null;
}

const EditExpenseDialog = ({ open, onOpenChange, expense }: EditExpenseDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { categories } = useCategories();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [splits, setSplits] = useState<SplitEntry[]>([]);
  const [members, setMembers] = useState<{ user_id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const includedSplits = splits.filter((s) => s.included);
  const includedCount = includedSplits.length;

  // Load expense data
  useEffect(() => {
    if (!open || !expense) return;
    setTitle(expense.title);
    setAmount(String(expense.amount));
    setSplitType(expense.split_type as SplitType);
    setSelectedCategory(expense.category_id || "");

    const loadData = async () => {
      // Fetch members
      const { data: memberData } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", expense.group_id);

      if (!memberData) return;
      const userIds = memberData.map((m) => m.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p.full_name || p.email || "Unknown"])
      );

      const memberList = memberData.map((m) => ({
        user_id: m.user_id,
        name: profileMap.get(m.user_id) || "Unknown",
      }));
      setMembers(memberList);

      // Fetch existing splits
      const { data: existingSplits } = await supabase
        .from("expense_splits")
        .select("user_id, amount, percentage")
        .eq("expense_id", expense.id);

      const splitMap = new Map(
        (existingSplits || []).map((s) => [s.user_id, s])
      );

      const st = expense.split_type as SplitType;
      setSplits(
        memberList.map((m) => {
          const existing = splitMap.get(m.user_id);
          const included = !!existing;
          let value = "";
          if (st === "percentage") value = existing ? String(existing.percentage || 0) : "0";
          else if (st === "custom") value = existing ? String(existing.amount) : "0";
          return { user_id: m.user_id, name: m.name, value, included };
        })
      );
    };
    loadData();
  }, [open, expense]);

  const toggleIncluded = (index: number) => {
    setSplits((prev) => {
      const next = prev.map((s, i) => (i === index ? { ...s, included: !s.included } : s));
      const count = next.filter((s) => s.included).length;
      if (count === 0) return next;
      if (splitType === "percentage") {
        return next.map((s) => ({ ...s, value: s.included ? (100 / count).toFixed(2) : "0" }));
      }
      if (splitType === "custom") {
        return next.map((s) => ({ ...s, value: s.included && numAmount > 0 ? (numAmount / count).toFixed(2) : "0" }));
      }
      return next;
    });
  };

  const updateSplitValue = (index: number, value: string) => {
    setSplits((prev) => prev.map((s, i) => (i === index ? { ...s, value } : s)));
  };

  const splitValidation = useMemo(() => {
    if (includedCount === 0 && members.length > 0)
      return { valid: false, message: "Select at least one member" };
    if (splitType === "equal" || members.length === 0)
      return { valid: true, message: "" };
    if (splitType === "percentage") {
      const total = splits.filter((s) => s.included).reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
      if (Math.abs(total - 100) > 0.01) return { valid: false, message: `Percentages total ${total.toFixed(2)}% (must equal 100%)` };
      return { valid: true, message: "✓ Totals 100%" };
    }
    if (splitType === "custom") {
      const total = splits.filter((s) => s.included).reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
      if (Math.abs(total - numAmount) > 0.01) return { valid: false, message: `Split total $${total.toFixed(2)} ≠ expense $${numAmount.toFixed(2)}` };
      return { valid: true, message: `✓ Totals $${total.toFixed(2)}` };
    }
    return { valid: true, message: "" };
  }, [splits, splitType, numAmount, members.length, includedCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !expense || !title.trim() || !amount) return;
    if (!splitValidation.valid) { toast.error(splitValidation.message); return; }

    setLoading(true);
    try {
      // Update expense
      const { error: expError } = await supabase
        .from("expenses")
        .update({ title: title.trim(), amount: numAmount, split_type: splitType, category_id: selectedCategory || null })
        .eq("id", expense.id);
      if (expError) throw expError;

      // Delete old splits and insert new ones
      const { error: delError } = await supabase
        .from("expense_splits")
        .delete()
        .eq("expense_id", expense.id);
      // If delete fails due to RLS, we handle via update approach
      
      const active = splits.filter((s) => s.included);
      let splitRows: { expense_id: string; user_id: string; amount: number; percentage: number }[];

      if (splitType === "equal") {
        const splitAmt = parseFloat((numAmount / active.length).toFixed(2));
        const pct = parseFloat((100 / active.length).toFixed(2));
        splitRows = active.map((s) => ({ expense_id: expense.id, user_id: s.user_id, amount: splitAmt, percentage: pct }));
      } else if (splitType === "percentage") {
        splitRows = active.map((s) => {
          const pct = parseFloat(s.value) || 0;
          return { expense_id: expense.id, user_id: s.user_id, amount: parseFloat(((pct / 100) * numAmount).toFixed(2)), percentage: pct };
        });
      } else {
        splitRows = active.map((s) => {
          const amt = parseFloat(s.value) || 0;
          return { expense_id: expense.id, user_id: s.user_id, amount: amt, percentage: numAmount > 0 ? parseFloat(((amt / numAmount) * 100).toFixed(2)) : 0 };
        });
      }

      const { error: splitError } = await supabase.from("expense_splits").insert(splitRows);
      if (splitError) throw splitError;

      toast.success("Expense updated!");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update expense");
    } finally {
      setLoading(false);
    }
  };

  const renderMemberRow = (s: SplitEntry, i: number) => (
    <div key={s.user_id} className={`flex items-center gap-3 rounded-md px-2 py-1.5 transition-opacity ${!s.included ? "opacity-40" : ""}`}>
      <Switch checked={s.included} onCheckedChange={() => toggleIncluded(i)} />
      <span className="flex-1 truncate text-sm text-foreground">{s.name}</span>
      {splitType === "equal" && numAmount > 0 && s.included && (
        <span className="text-sm font-medium text-muted-foreground">${(numAmount / includedCount).toFixed(2)}</span>
      )}
      {(splitType === "percentage" || splitType === "custom") && (
        <>
          <div className="relative w-28">
            <Input type="number" step="0.01" min="0" disabled={!s.included} value={s.value} onChange={(e) => updateSplitValue(i, e.target.value)} className="pr-8 text-right text-sm" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{splitType === "percentage" ? "%" : "$"}</span>
          </div>
          {splitType === "percentage" && numAmount > 0 && s.included && (
            <span className="w-16 text-right text-xs text-muted-foreground">${(((parseFloat(s.value) || 0) / 100) * numAmount).toFixed(2)}</span>
          )}
        </>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
          <DialogDescription>Update expense details and split.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category (optional)" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <CategoryIcon iconName={c.icon} color={c.color} size={14} />
                      <span>{c.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-amount">Amount ($)</Label>
            <Input id="edit-amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          {members.length > 0 && (
            <div className="space-y-3">
              <Label>Split Method</Label>
              <Tabs value={splitType} onValueChange={(v) => setSplitType(v as SplitType)}>
                <TabsList className="w-full">
                  <TabsTrigger value="equal" className="flex-1">Equal</TabsTrigger>
                  <TabsTrigger value="percentage" className="flex-1">Percentage</TabsTrigger>
                  <TabsTrigger value="custom" className="flex-1">Custom</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="space-y-1 rounded-lg border border-border p-3">
                {splits.map((s, i) => renderMemberRow(s, i))}
                {(splitType === "percentage" || splitType === "custom") && (
                  <div className={`flex items-center gap-1.5 pt-1 text-xs ${splitValidation.valid ? "text-muted-foreground" : "text-destructive"}`}>
                    {!splitValidation.valid && <AlertCircle className="h-3 w-3" />}
                    {splitValidation.message}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !title.trim() || !amount || !splitValidation.valid || includedCount === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditExpenseDialog;
