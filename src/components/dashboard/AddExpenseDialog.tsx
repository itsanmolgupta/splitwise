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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle } from "lucide-react";

interface Group {
  id: string;
  name: string;
}

interface GroupMember {
  user_id: string;
  profiles: { full_name: string | null; email: string | null } | null;
}

type SplitType = "equal" | "percentage" | "custom";

interface SplitEntry {
  user_id: string;
  name: string;
  value: string; // percentage or custom amount as string for input
}

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddExpenseDialog = ({ open, onOpenChange }: AddExpenseDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [splits, setSplits] = useState<SplitEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const numAmount = parseFloat(amount) || 0;

  // Fetch user's groups
  useEffect(() => {
    if (!open || !user) return;
    const fetchGroups = async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id, groups(id, name)")
        .eq("user_id", user.id);
      if (data) {
        setGroups(data.map((d: any) => d.groups).filter(Boolean));
      }
    };
    fetchGroups();
  }, [open, user]);

  // Fetch members when group changes
  useEffect(() => {
    if (!selectedGroup) {
      setMembers([]);
      return;
    }
    const fetchMembers = async () => {
      const { data } = await supabase
        .from("group_members")
        .select("user_id, profiles!inner(full_name, email)")
        .eq("group_id", selectedGroup) as any;
      if (data) setMembers(data);
    };
    fetchMembers();
  }, [selectedGroup]);

  // Initialize splits when members or splitType changes
  useEffect(() => {
    if (members.length === 0) {
      setSplits([]);
      return;
    }
    const defaultValue =
      splitType === "percentage"
        ? (100 / members.length).toFixed(2)
        : splitType === "custom"
        ? (numAmount / members.length || 0).toFixed(2)
        : "";

    setSplits(
      members.map((m) => ({
        user_id: m.user_id,
        name: m.profiles?.full_name || m.profiles?.email || "Unknown",
        value: defaultValue,
      }))
    );
  }, [members, splitType]);

  // Update custom amounts when total amount changes (only for custom)
  useEffect(() => {
    if (splitType === "custom" && members.length > 0 && numAmount > 0) {
      setSplits((prev) =>
        prev.map((s) => ({
          ...s,
          value: (numAmount / members.length).toFixed(2),
        }))
      );
    }
  }, [numAmount, splitType, members.length]);

  const updateSplitValue = (index: number, value: string) => {
    setSplits((prev) => prev.map((s, i) => (i === index ? { ...s, value } : s)));
  };

  // Validation
  const splitValidation = useMemo(() => {
    if (splitType === "equal" || members.length === 0) return { valid: true, message: "" };

    if (splitType === "percentage") {
      const total = splits.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
      const diff = Math.abs(total - 100);
      if (diff > 0.01) return { valid: false, message: `Percentages total ${total.toFixed(2)}% (must equal 100%)` };
      return { valid: true, message: "✓ Totals 100%" };
    }

    if (splitType === "custom") {
      const total = splits.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
      const diff = Math.abs(total - numAmount);
      if (diff > 0.01) return { valid: false, message: `Split total $${total.toFixed(2)} ≠ expense $${numAmount.toFixed(2)}` };
      return { valid: true, message: `✓ Totals $${total.toFixed(2)}` };
    }

    return { valid: true, message: "" };
  }, [splits, splitType, numAmount, members.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedGroup || !title.trim() || !amount) return;
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!splitValidation.valid) {
      toast.error(splitValidation.message);
      return;
    }

    setLoading(true);
    try {
      const { data: expense, error: expError } = await supabase
        .from("expenses")
        .insert({
          title: title.trim(),
          amount: numAmount,
          group_id: selectedGroup,
          paid_by: user.id,
          split_type: splitType,
        })
        .select()
        .single();

      if (expError) throw expError;

      if (members.length > 0) {
        let splitRows: { expense_id: string; user_id: string; amount: number; percentage: number }[];

        if (splitType === "equal") {
          const splitAmt = parseFloat((numAmount / members.length).toFixed(2));
          const pct = parseFloat((100 / members.length).toFixed(2));
          splitRows = members.map((m) => ({
            expense_id: expense.id,
            user_id: m.user_id,
            amount: splitAmt,
            percentage: pct,
          }));
        } else if (splitType === "percentage") {
          splitRows = splits.map((s) => {
            const pct = parseFloat(s.value) || 0;
            return {
              expense_id: expense.id,
              user_id: s.user_id,
              amount: parseFloat(((pct / 100) * numAmount).toFixed(2)),
              percentage: pct,
            };
          });
        } else {
          // custom
          splitRows = splits.map((s) => {
            const amt = parseFloat(s.value) || 0;
            return {
              expense_id: expense.id,
              user_id: s.user_id,
              amount: amt,
              percentage: numAmount > 0 ? parseFloat(((amt / numAmount) * 100).toFixed(2)) : 0,
            };
          });
        }

        const { error: splitError } = await supabase.from("expense_splits").insert(splitRows);
        if (splitError) throw splitError;
      }

      toast.success("Expense added!");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add expense");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setAmount("");
    setSelectedGroup("");
    setSplitType("equal");
    setSplits([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>Split an expense among group members.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group */}
          <div className="space-y-2">
            <Label>Group</Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="exp-title">Title</Label>
            <Input
              id="exp-title"
              placeholder="e.g. Dinner, Groceries"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="exp-amount">Amount ($)</Label>
            <Input
              id="exp-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {/* Split Type */}
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

              {/* Split details */}
              {splitType === "equal" && numAmount > 0 && (
                <p className="text-sm text-muted-foreground">
                  ${(numAmount / members.length).toFixed(2)} per person ({members.length} members)
                </p>
              )}

              {(splitType === "percentage" || splitType === "custom") && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  {splits.map((s, i) => (
                    <div key={s.user_id} className="flex items-center gap-3">
                      <span className="flex-1 truncate text-sm text-foreground">{s.name}</span>
                      <div className="relative w-28">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={s.value}
                          onChange={(e) => updateSplitValue(i, e.target.value)}
                          className="pr-8 text-right text-sm"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {splitType === "percentage" ? "%" : "$"}
                        </span>
                      </div>
                      {/* Show calculated amount for percentage */}
                      {splitType === "percentage" && numAmount > 0 && (
                        <span className="w-16 text-right text-xs text-muted-foreground">
                          ${(((parseFloat(s.value) || 0) / 100) * numAmount).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Validation message */}
                  <div className={`flex items-center gap-1.5 pt-1 text-xs ${splitValidation.valid ? "text-muted-foreground" : "text-destructive"}`}>
                    {!splitValidation.valid && <AlertCircle className="h-3 w-3" />}
                    {splitValidation.message}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim() || !amount || !selectedGroup || !splitValidation.valid}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddExpenseDialog;
