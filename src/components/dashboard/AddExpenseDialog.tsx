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
import { Switch } from "@/components/ui/switch";
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
  value: string;
  included: boolean;
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
  const includedSplits = splits.filter((s) => s.included);
  const includedCount = includedSplits.length;

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
      const { data: memberData } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", selectedGroup);
      if (!memberData || memberData.length === 0) {
        setMembers([]);
        return;
      }
      const userIds = memberData.map((m) => m.user_id);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profileData || []).map((p) => [p.user_id, p])
      );

      setMembers(
        memberData.map((m) => ({
          user_id: m.user_id,
          profiles: profileMap.get(m.user_id) || null,
        }))
      );
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
        included: true,
      }))
    );
  }, [members, splitType]);

  // Recalculate equal values when included members change or amount changes
  useEffect(() => {
    if (splitType === "custom" && includedCount > 0 && numAmount > 0) {
      setSplits((prev) =>
        prev.map((s) => ({
          ...s,
          value: s.included ? (numAmount / includedCount).toFixed(2) : "0",
        }))
      );
    }
  }, [numAmount, splitType, includedCount]);

  const toggleIncluded = (index: number) => {
    setSplits((prev) => {
      const next = prev.map((s, i) =>
        i === index ? { ...s, included: !s.included } : s
      );
      const newIncluded = next.filter((s) => s.included);
      const count = newIncluded.length;
      if (count === 0) return next;

      if (splitType === "percentage") {
        return next.map((s) => ({
          ...s,
          value: s.included ? (100 / count).toFixed(2) : "0",
        }));
      }
      if (splitType === "custom") {
        return next.map((s) => ({
          ...s,
          value: s.included && numAmount > 0 ? (numAmount / count).toFixed(2) : "0",
        }));
      }
      return next;
    });
  };

  const updateSplitValue = (index: number, value: string) => {
    setSplits((prev) => prev.map((s, i) => (i === index ? { ...s, value } : s)));
  };

  // Validation
  const splitValidation = useMemo(() => {
    if (includedCount === 0 && members.length > 0)
      return { valid: false, message: "Select at least one member" };
    if (splitType === "equal" || members.length === 0)
      return { valid: true, message: "" };

    if (splitType === "percentage") {
      const total = splits
        .filter((s) => s.included)
        .reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
      const diff = Math.abs(total - 100);
      if (diff > 0.01)
        return { valid: false, message: `Percentages total ${total.toFixed(2)}% (must equal 100%)` };
      return { valid: true, message: "✓ Totals 100%" };
    }

    if (splitType === "custom") {
      const total = splits
        .filter((s) => s.included)
        .reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
      const diff = Math.abs(total - numAmount);
      if (diff > 0.01)
        return { valid: false, message: `Split total $${total.toFixed(2)} ≠ expense $${numAmount.toFixed(2)}` };
      return { valid: true, message: `✓ Totals $${total.toFixed(2)}` };
    }

    return { valid: true, message: "" };
  }, [splits, splitType, numAmount, members.length, includedCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedGroup || !title.trim() || !amount) return;
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (includedCount === 0) {
      toast.error("Select at least one member");
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

      const active = splits.filter((s) => s.included);
      let splitRows: { expense_id: string; user_id: string; amount: number; percentage: number }[];

      if (splitType === "equal") {
        const splitAmt = parseFloat((numAmount / active.length).toFixed(2));
        const pct = parseFloat((100 / active.length).toFixed(2));
        splitRows = active.map((s) => ({
          expense_id: expense.id,
          user_id: s.user_id,
          amount: splitAmt,
          percentage: pct,
        }));
      } else if (splitType === "percentage") {
        splitRows = active.map((s) => {
          const pct = parseFloat(s.value) || 0;
          return {
            expense_id: expense.id,
            user_id: s.user_id,
            amount: parseFloat(((pct / 100) * numAmount).toFixed(2)),
            percentage: pct,
          };
        });
      } else {
        splitRows = active.map((s) => {
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

  const renderMemberRow = (s: SplitEntry, i: number) => (
    <div
      key={s.user_id}
      className={`flex items-center gap-3 rounded-md px-2 py-1.5 transition-opacity ${!s.included ? "opacity-40" : ""}`}
    >
      <Switch checked={s.included} onCheckedChange={() => toggleIncluded(i)} />
      <span className="flex-1 truncate text-sm text-foreground">{s.name}</span>

      {splitType === "equal" && numAmount > 0 && s.included && (
        <span className="text-sm font-medium text-muted-foreground">
          ${(numAmount / includedCount).toFixed(2)}
        </span>
      )}

      {(splitType === "percentage" || splitType === "custom") && (
        <>
          <div className="relative w-28">
            <Input
              type="number"
              step="0.01"
              min="0"
              disabled={!s.included}
              value={s.value}
              onChange={(e) => updateSplitValue(i, e.target.value)}
              className="pr-8 text-right text-sm"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {splitType === "percentage" ? "%" : "$"}
            </span>
          </div>
          {splitType === "percentage" && numAmount > 0 && s.included && (
            <span className="w-16 text-right text-xs text-muted-foreground">
              ${(((parseFloat(s.value) || 0) / 100) * numAmount).toFixed(2)}
            </span>
          )}
        </>
      )}
    </div>
  );

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

              {/* Member rows with toggles */}
              <div className="space-y-1 rounded-lg border border-border p-3">
                {splits.map((s, i) => renderMemberRow(s, i))}

                {splitType === "equal" && numAmount > 0 && includedCount > 0 && (
                  <p className="pt-1 text-xs text-muted-foreground">
                    ${(numAmount / includedCount).toFixed(2)} per person · {includedCount} of {members.length} members
                  </p>
                )}

                {(splitType === "percentage" || splitType === "custom") && (
                  <div className={`flex items-center gap-1.5 pt-1 text-xs ${splitValidation.valid ? "text-muted-foreground" : "text-destructive"}`}>
                    {!splitValidation.valid && <AlertCircle className="h-3 w-3" />}
                    {splitValidation.message}
                  </div>
                )}

                {includedCount === 0 && (
                  <p className="pt-1 text-xs text-destructive">Select at least one member</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim() || !amount || !selectedGroup || !splitValidation.valid || includedCount === 0}
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
