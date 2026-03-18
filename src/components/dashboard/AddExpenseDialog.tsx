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

interface Group {
  id: string;
  name: string;
}

interface GroupMember {
  user_id: string;
  profiles: { full_name: string | null; email: string | null } | null;
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
  const [loading, setLoading] = useState(false);

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
    if (!selectedGroup) { setMembers([]); return; }
    const fetchMembers = async () => {
      const { data } = await supabase
        .from("group_members")
        .select("user_id, profiles!inner(full_name, email)")
        .eq("group_id", selectedGroup) as any;
      if (data) setMembers(data);
    };
    fetchMembers();
  }, [selectedGroup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedGroup || !title.trim() || !amount) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      // Create expense
      const { data: expense, error: expError } = await supabase
        .from("expenses")
        .insert({
          title: title.trim(),
          amount: numAmount,
          group_id: selectedGroup,
          paid_by: user.id,
          split_type: "equal",
        })
        .select()
        .single();

      if (expError) throw expError;

      // Create equal splits for all members
      if (members.length > 0) {
        const splitAmount = parseFloat((numAmount / members.length).toFixed(2));
        const splits = members.map((m) => ({
          expense_id: expense.id,
          user_id: m.user_id,
          amount: splitAmount,
          percentage: parseFloat((100 / members.length).toFixed(2)),
        }));

        const { error: splitError } = await supabase.from("expense_splits").insert(splits);
        if (splitError) throw splitError;
      }

      toast.success("Expense added!");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      setTitle("");
      setAmount("");
      setSelectedGroup("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>Split an expense equally among group members.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          {members.length > 0 && amount && (
            <p className="text-sm text-muted-foreground">
              Split equally: ${(parseFloat(amount) / members.length).toFixed(2)} per person ({members.length} members)
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !title.trim() || !amount || !selectedGroup}>
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
