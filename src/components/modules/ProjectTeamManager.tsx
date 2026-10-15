"use client";

import React, { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAllUsersAction } from "@/actions/admin.actions";
import { assignUserToProjectAction, removeUserFromProjectAction } from "@/actions/assignment.actions";
import { UserPlus, UserMinus, LucideLoader2 } from "lucide-react";

interface TeamMember {
  id: string; // assignment id
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
  email: string;
}

interface ProjectTeamManagerProps {
  projectId: string;
  initialTeam: TeamMember[];
}

export function ProjectTeamManager({ projectId, initialTeam }: ProjectTeamManagerProps) {
  const [team, setTeam] = useState(initialTeam);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const loadUsers = async () => {
    const result = await getAllUsersAction();
    if (result?.success) {
      // Filter out users already on the team; prefer ops roles for assignment
      const teamUserIds = new Set(team.map((m: any) => m.user_id));
      const ops = (result.data || []).filter(
        (u: any) =>
          !teamUserIds.has(u.id) &&
          u.is_active !== false &&
          ['engineer', 'field', 'admin'].includes((u.role || '').toLowerCase())
      );
      setAllUsers(ops.length > 0 ? ops : (result.data || []).filter((u: any) => !teamUserIds.has(u.id)));
    } else {
      toast({ title: "Could not load staff", description: result?.error || "Unauthorized", variant: "error" });
      setAllUsers([]);
    }
  };

  const handleAssign = () => {
    if (!selectedUser || !selectedRole) return;

    startTransition(async () => {
      const result = await assignUserToProjectAction(projectId, selectedUser, selectedRole);
      if (result?.success) {
        toast({ title: "Member Assigned", variant: "success" });
        setIsDialogOpen(false);
        // In a real app, revalidatePath would update the server props, 
        // for this shell we'll just close and let the user know.
        // Re-fetching or local state update would go here.
      } else {
        toast({ title: "Error", description: result?.error || undefined, variant: "error" });
      }
    });
  };

  const handleRemove = (assignmentId: string, name: string) => {
    if (!confirm(`Remove ${name} from this project?`)) return;

    startTransition(async () => {
      const result = await removeUserFromProjectAction(assignmentId, projectId);
      if (result?.success) {
        toast({ title: "Member Removed", variant: "success" });
        setTeam(team.filter((m: any) => m.id !== assignmentId));
      } else {
        toast({ title: "Error", description: result?.error || undefined, variant: "error" });
      }
    });
  };

  return (
    <Card className="enterprise-card">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-lg">Project Team</CardTitle>
          <CardDescription>Members currently assigned to this project.</CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            setIsDialogOpen(true);
            loadUsers();
          }}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Assign Member
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {team.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground border-2 border-dashed border-white/5 rounded-xl">
            No team members assigned yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {team.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 group">
                <div className="flex items-center gap-3">
                  <Avatar fallback={`${member.first_name?.[0] || 'U'}${member.last_name?.[0] || ''}`} />
                  <div>
                    <p className="text-sm font-semibold">{member.first_name || 'Unknown'} {member.last_name || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{member.email || 'No email'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="glass" className="capitalize">{member.role?.replace('_', ' ') || 'Member'}</Badge>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 transition-all"
                    onClick={() => handleRemove(member.id, member.first_name)}
                    disabled={isPending}
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Team Member</DialogTitle>
            <DialogDescription>
              Select a team member and their role for this project.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select User</label>
              <Select 
                placeholder="Choose a teammate..." 
                value={selectedUser} 
                onValueChange={setSelectedUser}
              >
                {allUsers.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.first_name} {u.last_name} ({u.role})
                  </SelectItem>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Project Role</label>
              <Select 
                placeholder="Assign a role..." 
                value={selectedRole} 
                onValueChange={setSelectedRole}
              >
                <SelectItem value="engineer">Engineer</SelectItem>
                <SelectItem value="field">Field</SelectItem>
                <SelectItem value="sales_rep">Sales Rep</SelectItem>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={isPending || !selectedUser || !selectedRole}>
              {isPending ? <LucideLoader2 className="h-4 w-4 animate-spin" /> : "Assign to Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
