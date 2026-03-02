import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Role, listRoles, createRole, updateRole } from "@/services/roles";

export const RoleBuilder = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const { toast } = useToast();

    const [roleName, setRoleName] = useState("");
    const [roleDescription, setRoleDescription] = useState("");
    const [parentRoleId, setParentRoleId] = useState<string>("none");

    const fetchRoles = async () => {
        try {
            const data = await listRoles();
            setRoles(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    const handleEdit = (role: Role) => {
        setEditingRole(role);
        setRoleName(role.name);
        setRoleDescription(role.description || "");
        setParentRoleId(role.parentRoleId || "none");
        setIsDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingRole(null);
        setRoleName("");
        setRoleDescription("");
        setParentRoleId("none");
        setIsDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name: roleName,
                description: roleDescription,
                parentRoleId: parentRoleId === "none" ? null : parentRoleId
            };

            if (editingRole) {
                await updateRole(editingRole.id, payload);
            } else {
                await createRole(payload);
            }

            toast({ title: "Success", description: "Role saved" });
            setIsDialogOpen(false);
            fetchRoles();
        } catch (err) {
            toast({ title: "Error", description: "Failed to save role", variant: "destructive" });
        }
    };

    const getRoleName = (id: string | null | undefined) => {
        if (!id) return "None";
        const role = roles.find(r => r.id === id);
        return role ? role.name : "None";
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Role Hierarchy Definition</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Create and manage the organization's role hierarchy. Roles determine data visibility (who reports to whom).
                    </p>
                </div>
                <Button onClick={handleCreate}>Create Role</Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingRole ? "Edit Role" : "New Role"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label>Role Name</Label>
                            <Input value={roleName} onChange={e => setRoleName(e.target.value)} required placeholder="e.g. Sales Manager" />
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea value={roleDescription} onChange={e => setRoleDescription(e.target.value)} placeholder="Optional description" />
                        </div>

                        <div className="space-y-2">
                            <Label>Reports To (Parent Role)</Label>
                            <Select value={parentRoleId} onValueChange={setParentRoleId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Parent Role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Top Level (No Parent)</SelectItem>
                                    {roles.map(r => {
                                        const rId = r.id;
                                        // Prevent setting self as parent
                                        if (editingRole && editingRole.id === rId) return null;
                                        return (
                                            <SelectItem key={rId} value={rId}>{r.name}</SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Users in this role will roll up data to users in the parent role.
                            </p>
                        </div>

                        <Button type="submit" className="w-full">Save Role</Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-4">Role Name</TableHead>
                                <TableHead>Reports To</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {roles.map(role => (
                                <TableRow key={role.id}>
                                    <TableCell className="pl-4 font-medium">{role.name}</TableCell>
                                    <TableCell>{getRoleName(role.parentRoleId)}</TableCell>
                                    <TableCell>
                                        <Button variant="outline" size="sm" onClick={() => handleEdit(role)}>Edit</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {roles.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                        No roles configured in the hierarchy yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};
