import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createRole, listRoles, updateRole, deleteRole, Role } from "@/services/roles";
import { listUsers, User } from "@/services/users";

const AVAILABLE_PERMISSIONS = [
  // User & admin
  "users.manage",
  "accounts.manage",
  "properties.manage",
  "regions.manage",
  "workflows.manage",
  "availability.upload",
  "reports.view",
  "callcenter.access",
  // Lead module – view scopes
  "leads.view.own",
  "leads.view.team",
  "leads.view.all",
  // Lead module – actions
  "leads.create",
  "leads.update",
  "leads.assign",
  "leads.delete",
  "leads.send.quotation",
  "leads.schedule.followup",
  "leads.send.email",
  // Lead module – full control
  "leads.manage",
  // Ticket module – view scopes
  "tickets.view.own",
  "tickets.view.team",
  "tickets.view.all",
  // Ticket module – actions
  "tickets.create",
  "tickets.update",
  "tickets.assign",
  "tickets.delete",
  "tickets.resolve",
  // Ticket module – full control
  "tickets.manage",
  // Buddy module
  "buddies.assign",
  "buddies.view.history",
  "buddies.view.reports",
] as const;

export const RoleDefinition = () => {
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedMemberPermissions, setSelectedMemberPermissions] = useState<string[]>([]);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const [selectedOwnerPermissions, setSelectedOwnerPermissions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [rolesData, usersData] = await Promise.all([
        listRoles(),
        listUsers(),
      ]);
      // Ensure ownerPermissions and memberPermissions are arrays
      const normalizedRoles = (rolesData || []).map((role) => ({
        ...role,
        ownerPermissions: Array.isArray(role.ownerPermissions) ? role.ownerPermissions : [],
        memberPermissions: Array.isArray(role.memberPermissions) ? role.memberPermissions : [],
      }));
      setRoles(normalizedRoles);
      setUsers(usersData || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load data";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setRoleName(role.name);
      setRoleDescription(role.description || "");
      // Use memberPermissions if available, fallback to legacy permissions
      setSelectedMemberPermissions(role.memberPermissions && role.memberPermissions.length > 0 
        ? role.memberPermissions 
        : role.permissions || []);
      // Collect owner IDs from both ownerUserId (legacy) and ownerUserIds array
      const ownerIds: string[] = [];
      if (role.ownerUserId) {
        ownerIds.push(role.ownerUserId);
      }
      if (role.ownerUserIds && role.ownerUserIds.length > 0) {
        role.ownerUserIds.forEach((id) => {
          if (!ownerIds.includes(id)) {
            ownerIds.push(id);
          }
        });
      }
      setSelectedOwnerIds(ownerIds);
      setSelectedOwnerPermissions(role.ownerPermissions || []);
    } else {
      setEditingRole(null);
      setRoleName("");
      setRoleDescription("");
      setSelectedMemberPermissions([]);
      setSelectedOwnerIds([]);
      setSelectedOwnerPermissions([]);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRole(null);
    setRoleName("");
    setRoleDescription("");
    setSelectedMemberPermissions([]);
    setSelectedOwnerIds([]);
    setSelectedOwnerPermissions([]);
  };

  const handleSubmit = async () => {
    if (!roleName.trim()) {
      toast({
        title: "Error",
        description: "Role name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      if (!selectedMemberPermissions || selectedMemberPermissions.length === 0) {
        toast({
          title: "Error",
          description: "Member permissions are required",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      if (!selectedOwnerPermissions || selectedOwnerPermissions.length === 0) {
        toast({
          title: "Error",
          description: "Owner permissions are required",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      const memberPermissions = selectedMemberPermissions;
      const ownerPermissions = selectedOwnerPermissions;
      const ownerUserIds = selectedOwnerIds.length > 0 ? selectedOwnerIds : undefined;
      
      if (editingRole) {
        await updateRole(editingRole.id, {
          name: roleName.trim(),
          description: roleDescription.trim() || undefined,
          memberPermissions,
          ownerPermissions,
          ownerUserIds,
        });
        toast({
          title: "Success",
          description: "Role updated successfully",
        });
      } else {
        await createRole({
          name: roleName.trim(),
          description: roleDescription.trim() || undefined,
          memberPermissions,
          ownerPermissions,
          ownerUserIds,
        });
        toast({
          title: "Success",
          description: "Role created successfully",
        });
      }
      handleCloseDialog();
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save role";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (roleId: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    try {
      await deleteRole(roleId);
      toast({
        title: "Success",
        description: "Role deleted successfully",
      });
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete role";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Loading roles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadData} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Role Definition</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage global roles for the CRM. Assign backend permissions,
            including detailed lead view and action permissions, to each role.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </div>

      {roles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">No roles created yet</p>
            <Button onClick={() => handleOpenDialog()} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Create First Role
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{role.name}</CardTitle>
                    {role.description && (
                      <CardDescription>{role.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(role)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(role.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-2 block">
                    Member Permissions (for Group Members)
                  </Label>
                  {(role.memberPermissions && role.memberPermissions.length > 0) || (role.permissions && role.permissions.length > 0) ? (
                    <div className="flex flex-wrap gap-2">
                      {(role.memberPermissions && role.memberPermissions.length > 0 ? role.memberPermissions : role.permissions || []).map((perm) => (
                        <Badge key={perm} variant="secondary" className="text-xs">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No member permissions assigned</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-2 block">
                    Owner Permissions (for Role Owners/SPOCs)
                  </Label>
                  {Array.isArray(role.ownerPermissions) && role.ownerPermissions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {role.ownerPermissions.map((perm) => (
                        <Badge key={perm} variant="outline" className="text-xs">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No owner permissions assigned</p>
                  )}
                </div>
                {(role.ownerUserId || (role.ownerUserIds && role.ownerUserIds.length > 0)) && (
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-2 block">
                      Owners (SPOCs)
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {role.ownerUserIds && role.ownerUserIds.length > 0 ? (
                        role.ownerUserIds.map((ownerId) => {
                          const owner = users.find((u) => u.id === ownerId);
                          return owner ? (
                            <Badge key={ownerId} variant="outline" className="text-xs">
                              {owner.name}
                            </Badge>
                          ) : null;
                        })
                      ) : role.ownerUserId ? (
                        (() => {
                          const owner = users.find((u) => u.id === role.ownerUserId);
                          return owner ? (
                            <Badge variant="outline" className="text-xs">
                              {owner.name}
                            </Badge>
                          ) : null;
                        })()
                      ) : null}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create Role"}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? "Update the role information and permissions."
                : "Define a new role with backend permissions."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name *</Label>
              <Input
                id="role-name"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="Admin"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="Describe what this role can do"
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>Member Permissions (for Group Members) *</Label>
              <p className="text-xs text-muted-foreground">
                These permissions will be granted to all users in employee groups mapped to this role.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                {AVAILABLE_PERMISSIONS.map((perm) => (
                  <div key={`member-perm-${perm}`} className="flex items-center space-x-2">
                    <Checkbox
                      id={`member-perm-${perm}`}
                      checked={selectedMemberPermissions.includes(perm)}
                      onCheckedChange={(checked) => {
                        setSelectedMemberPermissions((prev) =>
                          checked ? [...prev, perm] : prev.filter((p) => p !== perm),
                        );
                      }}
                    />
                    <label
                      htmlFor={`member-perm-${perm}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {perm}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Owner Permissions (for Role Owners/SPOCs) *</Label>
              <p className="text-xs text-muted-foreground">
                These permissions will be granted to users who are owners (SPOCs) of this role.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                {AVAILABLE_PERMISSIONS.map((perm) => (
                  <div key={`owner-perm-${perm}`} className="flex items-center space-x-2">
                    <Checkbox
                      id={`owner-perm-${perm}`}
                      checked={selectedOwnerPermissions.includes(perm)}
                      onCheckedChange={(checked) => {
                        setSelectedOwnerPermissions((prev) =>
                          checked ? [...prev, perm] : prev.filter((p) => p !== perm),
                        );
                      }}
                    />
                    <label
                      htmlFor={`owner-perm-${perm}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {perm}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Owners (SPOCs)</Label>
              <p className="text-xs text-muted-foreground">
                Select users who will be owners (SPOCs) of this role. They will receive the owner permissions specified above.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No users available</p>
                ) : (
                  users.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`owner-${user.id}`}
                        checked={selectedOwnerIds.includes(user.id)}
                        onCheckedChange={(checked) => {
                          setSelectedOwnerIds((prev) =>
                            checked ? [...prev, user.id] : prev.filter((id) => id !== user.id),
                          );
                        }}
                      />
                      <label
                        htmlFor={`owner-${user.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        <div>
                          <div>{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingRole ? "Update Role" : "Create Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};


