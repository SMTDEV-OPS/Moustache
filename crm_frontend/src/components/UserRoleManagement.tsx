import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, UserMinus, Users as UsersIcon, Building2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createUser, listUsers, User } from "@/services/users";
import { listRoles, Role, listRoleOwners, addRoleOwners, removeRoleOwner, RoleUser } from "@/services/roles";
import { listGroups, listUsersInGroup, Group } from "@/services/groups";

export const UserRoleManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "role-mapping">("create");
  
  // Role Definition Mapping state
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [roleOwners, setRoleOwners] = useState<RoleUser[]>([]);
  const [isLoadingOwners, setIsLoadingOwners] = useState(false);
  const [selectedOwnerToAdd, setSelectedOwnerToAdd] = useState<string>("");
  const [groupsWithRole, setGroupsWithRole] = useState<Group[]>([]);
  const [groupMembers, setGroupMembers] = useState<Record<string, User[]>>({});

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (selectedRoleId) {
      void loadRoleDetails(selectedRoleId);
    } else {
      setRoleOwners([]);
      setGroupsWithRole([]);
      setGroupMembers({});
    }
  }, [selectedRoleId, groups]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [usersData, rolesData, groupsData] = await Promise.all([
        listUsers(),
        listRoles(),
        listGroups(),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setGroups(groupsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load data";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoleDetails = async (roleId: string) => {
    try {
      setIsLoadingOwners(true);
      
      // Load role owners
      const owners = await listRoleOwners(roleId);
      setRoleOwners(owners);

      // Find groups that have this role mapped
      const groupsWithThisRole = groups.filter(
        (g) => g.roleIds && g.roleIds.includes(roleId)
      );
      setGroupsWithRole(groupsWithThisRole);

      // Load members for each group
      const membersMap: Record<string, User[]> = {};
      for (const group of groupsWithThisRole) {
        try {
          const members = await listUsersInGroup(group.id);
          membersMap[group.id] = members;
        } catch (err) {
          console.error(`Failed to load members for group ${group.id}:`, err);
          membersMap[group.id] = [];
        }
      }
      setGroupMembers(membersMap);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load role details";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingOwners(false);
    }
  };

  const handleCreateUser = async () => {
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Email and password are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await createUser({
        name: `${firstName} ${lastName}`.trim() || email.trim(),
        email: email.trim(),
        password,      });

      toast({
        title: "Success",
        description: "User created successfully",
      });

      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create user";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Role Definition Mapping handlers
  const handleRoleSelect = (roleId: string) => {
    setSelectedRoleId(roleId);
    if (!roleId) {
      setRoleOwners([]);
      setGroupsWithRole([]);
      setGroupMembers({});
    }
  };

  const handleAddOwner = async () => {
    if (!selectedRoleId || !selectedOwnerToAdd) {
      toast({
        title: "Error",
        description: "Please select a role and a user to add as owner",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const updatedOwners = await addRoleOwners(selectedRoleId, [selectedOwnerToAdd]);
      setRoleOwners(updatedOwners);
      setSelectedOwnerToAdd("");
      toast({
        title: "Success",
        description: "Owner (SPOC) added successfully",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to add owner";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveOwner = async (userId: string) => {
    if (!selectedRoleId) return;

    try {
      await removeRoleOwner(selectedRoleId, userId);
      const updatedOwners = await listRoleOwners(selectedRoleId);
      setRoleOwners(updatedOwners);
      toast({
        title: "Success",
        description: "Owner (SPOC) removed successfully",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to remove owner";
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
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const renderRoleMappingTab = () => {
    const selectedRole = roles.find((r) => r.id === selectedRoleId);
    const ownerIds = new Set(roleOwners.map((o) => o.id));
    const availableUsers = users.filter((u) => !ownerIds.has(u.id));

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              Role Definition Mapping
            </CardTitle>
            <CardDescription>
              Select a role to manage its owners (SPOCs) and view employee groups mapped to it. 
              When a role is mapped to an employee group, all members of that group automatically receive the role. 
              Role owners can view team leads for employees in groups mapped to their roles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="role-select">Select Role</Label>
              <Select
                value={selectedRoleId}
                onValueChange={handleRoleSelect}
              >
                <SelectTrigger id="role-select">
                  <SelectValue placeholder="Choose a role to manage..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.length === 0 ? (
                    <SelectItem value="" disabled>
                      No roles available
                    </SelectItem>
                  ) : (
                    roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedRole && (
              <>
                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="font-semibold text-sm mb-2">{selectedRole.name}</h4>
                  {selectedRole.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {selectedRole.description}
                    </p>
                  )}
                  <div className="space-y-2 mt-2">
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                        Member Permissions
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {(selectedRole.memberPermissions && selectedRole.memberPermissions.length > 0 
                          ? selectedRole.memberPermissions 
                          : selectedRole.permissions || []).map((perm) => (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {selectedRole.ownerPermissions && selectedRole.ownerPermissions.length > 0 && (
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                          Owner Permissions
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {selectedRole.ownerPermissions.map((perm) => (
                            <Badge key={perm} variant="outline" className="text-xs">
                              {perm}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Role Owners Section */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold">Owners (SPOCs)</Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      Owners of this role can view team leads for employees in groups mapped to this role.
                    </p>
                    {isLoadingOwners ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : roleOwners.length === 0 ? (
                      <Card className="mt-2">
                        <CardContent className="py-6 text-center text-sm text-muted-foreground">
                          No owners (SPOCs) assigned to this role yet.
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="mt-2">
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {roleOwners.map((owner) => (
                                <TableRow key={owner.id}>
                                  <TableCell className="font-medium">{owner.name}</TableCell>
                                  <TableCell>{owner.email}</TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRemoveOwner(owner.id)}
                                    >
                                      <UserMinus className="h-4 w-4 mr-2" />
                                      Remove
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {availableUsers.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <Label className="text-sm font-semibold">Add Owner (SPOC)</Label>
                        <div className="flex gap-2">
                          <Select
                            value={selectedOwnerToAdd}
                            onValueChange={setSelectedOwnerToAdd}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select a user to add as owner..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableUsers.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.name} ({user.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={handleAddOwner}
                            disabled={!selectedOwnerToAdd || isSubmitting}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            {isSubmitting ? "Adding..." : "Add Owner"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Employee Groups Section */}
                  <div>
                    <Label className="text-base font-semibold">Employee Groups with This Role</Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      Groups mapped to this role. All members of these groups automatically have this role. 
                      To map groups to roles, use the Employee Groups Management page.
                    </p>
                    {isLoadingOwners ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : groupsWithRole.length === 0 ? (
                      <Card className="mt-2">
                        <CardContent className="py-6 text-center text-sm text-muted-foreground">
                          No employee groups are mapped to this role yet. Map groups via the Employee Groups Management page.
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4 mt-2">
                        {groupsWithRole.map((group) => {
                          const members = groupMembers[group.id] || [];
                          return (
                            <Card key={group.id}>
                              <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  <CardTitle className="text-base">{group.name}</CardTitle>                                    </Badge>
                                  )}
                                </div>
                                {group.description && (
                                  <CardDescription className="text-xs mt-1">
                                    {group.description}
                                  </CardDescription>
                                )}
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  <div className="text-xs font-semibold text-muted-foreground">
                                    Members ({members.length})
                                  </div>
                                  {members.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No members in this group</p>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {members.map((member) => (
                                        <Badge key={member.id} variant="secondary" className="text-xs">
                                          {member.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {!selectedRoleId && roles.length > 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Select a role above to view and manage its owners (SPOCs) and mapped employee groups.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderCreateTab = () => (
    <Card>
      <CardHeader>
        <CardTitle>Create User</CardTitle>
        <CardDescription>Fill the details below to create a CRM user. Roles are assigned via employee groups.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="user-first-name">First Name</Label>
            <Input
              id="user-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-last-name">Last Name</Label>
            <Input
              id="user-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-email">Email *</Label>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-password">Password *</Label>
          <Input
            id="user-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            required
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleCreateUser} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create User"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">User Role Management</h1>
        <p className="text-muted-foreground">
          Create CRM users and manage role definitions. Users get roles automatically when they are added to employee groups that have roles mapped. 
          Role owners (SPOCs) can view team leads for employees in groups mapped to their roles.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-2 h-11">
          <TabsTrigger value="create" className="px-4">Create User</TabsTrigger>
          <TabsTrigger value="role-mapping" className="px-4">Role Definition Mapping</TabsTrigger>
        </TabsList>
        <TabsContent value="create" className="pt-6">
          {renderCreateTab()}
        </TabsContent>
        <TabsContent value="role-mapping" className="pt-6">
          {renderRoleMappingTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
};
