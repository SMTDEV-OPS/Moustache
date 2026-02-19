import { useState, useEffect } from "react";
import { getAuthToken, API_BASE_URL } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

interface Role {
    _id: string;
    name: string;
    permissions: string[];
}

const RESOURCES = ["leads", "bookings", "users", "roles", "reports", "tasks"];
const ACTIONS = ["create", "read", "update", "delete", "manage"];
const SCOPES = ["global", "region", "team", "own", "none"];

export const RoleBuilder = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const { toast } = useToast();

    // Map of "resource:action" -> scope string
    const [permissionMap, setPermissionMap] = useState<Record<string, string>>({});
    const [roleName, setRoleName] = useState("");

    const fetchRoles = async () => {
        try {
            const token = getAuthToken();
            const res = await fetch(`${API_BASE_URL}/roles`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
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

        // Parse permissions into map
        const map: Record<string, string> = {};
        role.permissions.forEach(p => {
            const [res, act, scope] = p.split(":");
            if (res && act) {
                map[`${res}:${act}`] = scope || "global";
            }
        });
        setPermissionMap(map);
        setIsDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingRole(null);
        setRoleName("");
        setPermissionMap({});
        setIsDialogOpen(true);
    };

    const handlePermissionChange = (resource: string, action: string, scope: string) => {
        const key = `${resource}:${action}`;
        setPermissionMap(prev => {
            if (scope === "none") {
                const copy = { ...prev };
                delete copy[key];
                return copy;
            }
            return { ...prev, [key]: scope };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = getAuthToken();
            const method = editingRole ? "PATCH" : "POST";
            const url = editingRole ? `${API_BASE_URL}/roles/${editingRole._id}` : `${API_BASE_URL}/roles`;

            // Reconstruct permissions array from map
            const permissions = Object.entries(permissionMap).map(([key, scope]) => {
                const [res, act] = key.split(":");
                return `${res}:${act}:${scope}`;
            });

            const res = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name: roleName, permissions })
            });

            if (!res.ok) throw new Error("Failed to save role");

            toast({ title: "Success", description: "Role saved" });
            setIsDialogOpen(false);
            fetchRoles();
        } catch (err) {
            toast({ title: "Error", description: "Failed to save role", variant: "destructive" });
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Role Management</h1>
                <Button onClick={handleCreate}>Create Role</Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRole ? "Edit Role" : "New Role"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label>Role Name</Label>
                            <Input value={roleName} onChange={e => setRoleName(e.target.value)} required />
                        </div>

                        <div className="border rounded-md p-4">
                            <Label className="text-lg font-semibold mb-4 block">Permissions Matrix</Label>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Resource</TableHead>
                                            {ACTIONS.map(action => <TableHead key={action} className="capitalize">{action}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {RESOURCES.map(res => (
                                            <TableRow key={res}>
                                                <TableCell className="font-medium capitalize">{res}</TableCell>
                                                {ACTIONS.map(act => {
                                                    const currentScope = permissionMap[`${res}:${act}`] || "none";
                                                    return (
                                                        <TableCell key={act}>
                                                            <Select value={currentScope} onValueChange={v => handlePermissionChange(res, act, v)}>
                                                                <SelectTrigger className="h-8 w-[110px]">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {SCOPES.map(s => (
                                                                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
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
                                <TableHead>Permissions Count</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {roles.map(role => (
                                <TableRow key={role._id}>
                                    <TableCell className="pl-4 font-medium">{role.name}</TableCell>
                                    <TableCell>{role.permissions?.length || 0}</TableCell>
                                    <TableCell>
                                        <Button variant="outline" size="sm" onClick={() => handleEdit(role)}>Edit</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};
