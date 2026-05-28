import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit, Users as UsersIcon, Building2, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listGroups, createGroup, updateGroup, deleteGroup, listUsersInGroup, addUsersToGroup, removeUserFromGroup, listRolesForGroup, addRolesToGroup, removeRoleFromGroup, Group } from "@/services/groups";
import { listUsers, User } from "@/services/users";
import { listRoles, Role } from "@/services/roles";

type ActiveTab = "details" | "members" | "roles";

export const EmployeeGroupsManagement = () => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [groupRoles, setGroupRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("details");

  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupTeamType, setGroupTeamType] = useState<string | undefined>();
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      void loadGroupDetails(selectedGroupId);
    } else {
      setGroupMembers([]);
      setGroupRoles([]);
    }
  }, [selectedGroupId]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [groupsData, usersData, rolesData] = await Promise.all([
        listGroups(),
        listUsers(),
        listRoles(),
      ]);
      setGroups(groupsData);
      setUsers(usersData);
      setRoles(rolesData);
      if (groupsData.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groupsData[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load groups";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroupDetails = async (groupId: string) => {
    try {
      const [members, groupRoleList] = await Promise.all([
        listUsersInGroup(groupId),
        listRolesForGroup(groupId),
      ]);
      setGroupMembers(members);
      setGroupRoles(groupRoleList);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load group details";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleCreateOrUpdateGroup = async () => {
    if (!groupName.trim()) {
      toast({
        title: "Error",
        description: "Group name is required",
        variant: "destructive",
      });
      return;
    }
    try {
      setIsSubmitting(true);
      if (editingGroup) {
        await updateGroup(editingGroup.id, {
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,        });
        toast({
          title: "Success",
          description: "Group updated successfully",
        });
      } else {
        const group = await createGroup({
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,        });
        setSelectedGroupId(group.id);
        toast({
          title: "Success",
          description: "Group created successfully",
        });
      }
      setGroupName("");
      setGroupDescription("");
      setGroupTeamType(undefined);
      setEditingGroup(null);
      await loadInitialData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save group";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || "");    setSelectedGroupId(group.id);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to delete this group?")) return;
    try {
      await deleteGroup(groupId);
      toast({
        title: "Success",
        description: "Group deleted successfully",
      });
      if (selectedGroupId === groupId) {
        const remaining = groups.filter((g) => g.id !== groupId);
        setSelectedGroupId(remaining.length > 0 ? remaining[0].id : null);
      }
      await loadInitialData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete group";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!selectedGroupId) return;
    try {
      await addUsersToGroup(selectedGroupId, [userId]);
      toast({
        title: "Success",
        description: "User added to group",
      });
      await loadGroupDetails(selectedGroupId);
      await loadInitialData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to add user to group";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroupId) return;
    try {
      await removeUserFromGroup(selectedGroupId, userId);
      toast({
        title: "Success",
        description: "User removed from group",
      });
      await loadGroupDetails(selectedGroupId);
      await loadInitialData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to remove user from group";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleAddRoleToGroup = async (roleId: string) => {
    if (!selectedGroupId) return;
    try {
      await addRolesToGroup(selectedGroupId, [roleId]);
      toast({
        title: "Success",
        description: "Role added to group. All group members now have this role.",
      });
      await loadGroupDetails(selectedGroupId);
      await loadInitialData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to add role to group";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveRoleFromGroup = async (roleId: string) => {
    if (!selectedGroupId) return;
    try {
      await removeRoleFromGroup(selectedGroupId, roleId);
      toast({
        title: "Success",
        description: "Role removed from group",
      });
      await loadGroupDetails(selectedGroupId);
      await loadInitialData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to remove role from group";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  const availableMembers = users.filter(
    (u) => !groupMembers.some((m) => m.id === u.id)
  );

  const availableRoles = roles.filter(
    (r) => !groupRoles.some((gr) => gr.id === r.id)
  );

  if (isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Loading groups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Employee Groups</h2>
          <p className="text-sm text-muted-foreground">
            Define employee groups (teams), manage their members, and map roles.
            When a role is mapped to a group, all group members automatically receive that role.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingGroup(null);
            setGroupName("");
            setGroupDescription("");
            setGroupTeamType(undefined);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Group
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr,2fr]">
        {/* Group list and editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Groups</CardTitle>
              <CardDescription>Select a group to manage its details, members, and roles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No groups created yet. Use the form below to create the first group.
                </p>
              ) : (
                <div className="space-y-2">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => setSelectedGroupId(group.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors ${selectedGroupId === group.id ? "border-primary bg-primary/5" : "border-border"
                        }`}
                    >
                      <div>
                        <div className="font-medium">{group.name}</div>
                        {group.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {group.description}
                          </div>
                        )}
                        <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                          <span>{group.isActive ? "Active" : "Inactive"}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditGroup(group);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteGroup(group.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{editingGroup ? "Edit Group" : "Create Group"}</CardTitle>
              <CardDescription>
                {editingGroup
                  ? "Update the selected group's details."
                  : "Define a new employee group for routing and accountability."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="group-name">Group Name *</Label>
                <Input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Sales Inbound"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-description">Description</Label>
                <Input
                  id="group-description"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="This group handles inbound sales leads."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-team-type">Team Type (optional)</Label>
                <Select
                  value={groupTeamType || ""}
                  onValueChange={(value) => setGroupTeamType(value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESERVATIONS">Reservations</SelectItem>
                    <SelectItem value="SALES">Sales</SelectItem>
                    <SelectItem value="OPERATIONS">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCreateOrUpdateGroup} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingGroup ? "Update Group" : "Create Group"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Group details: tabs for details, members, and roles */}
        <div className="space-y-4">
          {selectedGroup ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      {selectedGroup.name}
                    </CardTitle>
                    <CardDescription>
                      Manage group details, members, and roles.
                    </CardDescription>
                  </div>
                  <Badge variant={selectedGroup.isActive ? "secondary" : "outline"}>
                    {selectedGroup.isActive ? "Active" : "Inactive"}
                  </Badge>
                </CardHeader>
              </Card>

              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="roles">Roles</TabsTrigger>
                </TabsList>

                {/* Tab 1: Group Details */}
                <TabsContent value="details" className="pt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Group Details</CardTitle>
                      <CardDescription>
                        View and edit group metadata. Click edit in the group list to modify these fields.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-semibold">Name</Label>
                        <p className="text-sm mt-1">{selectedGroup.name}</p>
                      </div>
                      {selectedGroup.description && (
                        <div>
                          <Label className="text-sm font-semibold">Description</Label>
                          <p className="text-sm mt-1 text-muted-foreground">{selectedGroup.description}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Mapped Roles
                      </CardTitle>
                      <CardDescription>
                        Roles currently mapped to this group. All group members automatically have these roles.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {groupRoles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No roles mapped to this group. Add roles in the Roles tab.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {groupRoles.map((role) => (
                            <div
                              key={role.id}
                              className="flex items-center justify-between rounded-md border p-3"
                            >
                              <div>
                                <div className="font-medium text-sm">{role.name}</div>
                                {role.description && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {role.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab 2: Members */}
                <TabsContent value="members" className="pt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Group Members</CardTitle>
                      <CardDescription>
                        Users currently in this group.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {groupMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No users in this group yet.
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupMembers.map((u) => (
                              <TableRow key={u.id}>
                                <TableCell className="font-medium">{u.name}</TableCell>
                                <TableCell>{u.email}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void handleRemoveMember(u.id)}
                                  >
                                    Remove
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Add Users to Group</CardTitle>
                      <CardDescription>Select users to add to this group.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {availableMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          All users are already in this group.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {availableMembers.map((u) => (
                            <div
                              key={u.id}
                              className="flex items-center justify-between rounded-md border p-2 text-sm"
                            >
                              <div>
                                <div className="font-medium">{u.name}</div>
                                <div className="text-xs text-muted-foreground">{u.email}</div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleAddMember(u.id)}
                              >
                                Add
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                {/* Tab 3: Roles */}
                <TabsContent value="roles" className="pt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Roles for Group</CardTitle>
                      <CardDescription>
                        Roles mapped to this group determine its permissions and accountability.
                        All members of this group automatically receive these roles.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {groupRoles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No roles assigned to this group yet.
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupRoles.map((role) => (
                              <TableRow key={role.id}>
                                <TableCell className="font-medium">{role.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {role.description || "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void handleRemoveRoleFromGroup(role.id)}
                                  >
                                    Remove
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Add Roles to Group</CardTitle>
                      <CardDescription>Select roles to map to this group. All group members will automatically receive these roles.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {availableRoles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          All roles are already assigned to this group.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {availableRoles.map((role) => (
                            <div
                              key={role.id}
                              className="flex items-center justify-between rounded-md border p-2 text-sm"
                            >
                              <div>
                                <div className="font-medium">{role.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {role.description || "-"}
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleAddRoleToGroup(role.id)}
                              >
                                Add
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

              </Tabs>
            </>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Select a group on the left or create a new one to begin managing employees and roles.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
