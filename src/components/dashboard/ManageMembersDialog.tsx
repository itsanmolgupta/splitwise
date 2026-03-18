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
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, UserPlus, Trash2, Crown } from "lucide-react";

interface Member {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
}

interface ManageMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  createdBy: string;
}

const ManageMembersDialog = ({ open, onOpenChange, groupId, groupName, createdBy }: ManageMembersDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const isAdmin = user?.id === createdBy;

  useEffect(() => {
    if (!open || !groupId) return;
    const fetchMembers = async () => {
      setFetching(true);
      try {
        const { data } = await supabase
          .from("group_members")
          .select("id, user_id, role")
          .eq("group_id", groupId);

        if (!data) { setMembers([]); return; }

        const userIds = data.map((m) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);

        const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

        setMembers(
          data.map((m) => ({
            ...m,
            full_name: profileMap.get(m.user_id)?.full_name ?? null,
            email: profileMap.get(m.user_id)?.email ?? null,
          }))
        );
      } finally {
        setFetching(false);
      }
    };
    fetchMembers();
  }, [open, groupId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      // Look up the user by email in profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        toast.error("No user found with that email. They need to sign up first.");
        return;
      }

      // Check if already a member
      const existing = members.find((m) => m.user_id === profile.user_id);
      if (existing) {
        toast.error("This user is already in the group.");
        return;
      }

      const { error } = await supabase
        .from("group_members")
        .insert({ group_id: groupId, user_id: profile.user_id, role: "member" });

      if (error) throw error;

      toast.success("Member added!");
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["groups"] });

      // Refresh members list
      const { data: newMember } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("user_id", profile.user_id)
        .single();

      if (newMember) {
        setMembers((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            user_id: newMember.user_id,
            role: "member",
            full_name: newMember.full_name,
            email: newMember.email,
          },
        ]);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (member: Member) => {
    if (member.user_id === createdBy) {
      toast.error("Cannot remove the group creator.");
      return;
    }

    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", member.user_id);

      if (error) throw error;

      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Member removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    }
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    if (email) return email[0].toUpperCase();
    return "?";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Members</DialogTitle>
          <DialogDescription>{groupName}</DialogDescription>
        </DialogHeader>

        {/* Invite form */}
        <form onSubmit={handleInvite} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="invite-email" className="sr-only">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="Enter email to invite"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={loading} className="gap-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Add
          </Button>
        </form>

        {/* Members list */}
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {fetching ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {getInitials(member.full_name, member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {member.full_name || member.email || "Unknown"}
                    {member.user_id === user?.id && (
                      <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                    )}
                  </p>
                  {member.full_name && member.email && (
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  )}
                </div>
                {member.user_id === createdBy && (
                  <Crown className="h-4 w-4 text-amber-500" />
                )}
                {isAdmin && member.user_id !== createdBy && member.user_id !== user?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(member)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageMembersDialog;
