import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getAuthToken, API_BASE_URL } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

interface User {
    _id: string;
    name: string;
    email: string;
    teamType: string;
    roleId?: string;
    reportsTo?: string; // ID
    hierarchyPath?: string;
}

interface Role {
    _id: string;
    name: string;
}

export const UserManagement = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        teamType: "management",
        roleId: "",
        reportsTo: "none"
    });

    const fetchUsers = async () => {
        try {
            const token = getAuthToken();
            // Using /users/hierarchy to get clean list or /users
            const res = await fetch(`${API_BASE_URL}/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setUsers(data);
        } catch (err) {
            console.error(err);
        }
    };

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
        Promise.all([fetchUsers(), fetchRoles()]).finally(() => setIsLoading(false));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = getAuthToken();
            const method = editingUser ? "PATCH" : "POST";
            const url = editingUser
                ? `${API_BASE_URL}/users/${editingUser._id}`
                : `${API_BASE_URL}/users`;

            const payload: any = { ...formData };
            if (payload.reportsTo === "none") payload.reportsTo = null;
            if (!payload.password && method === "PATCH") delete payload.password;

            // Handle empty roleId
            if (!payload.roleId) delete payload.roleId;

            const res = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed to save user");

            toast({ title: "Success", description: "User saved successfully" });
            setIsDialogOpen(false);
            setEditingUser(null);
            fetchUsers();
        } catch (err) {
            toast({ title: "Error", description: "Failed to save user", variant: "destructive" });
        }
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            password: "",
            teamType: user.teamType,
            roleId: user.roleId || "",
            reportsTo: user.reportsTo || "none"
        });
        setIsDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingUser(null);
        setFormData({
            name: "",
            email: "",
            password: "",
            teamType: "management",
            roleId: "",
            reportsTo: "none"
        });
        setIsDialogOpen(true);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">User Management</h1>
                <Button onClick={handleCreate}>Add User</Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingUser ? "Edit User" : "Create User"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required disabled={!!editingUser} />
                        </div>
                        {!editingUser && (
                            <div className="space-y-2">
                                <Label>Password</Label>
                                <Input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required />
                            </div>
                        )}
                        {editingUser && (
                            <div className="space-y-2">
                                <Label>New Password (Optional)</Label>
                                <Input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Team</Label>
                            <Select value={formData.teamType} onValueChange={v => setFormData({ ...formData, teamType: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="management">Management</SelectItem>
                                    <SelectItem value="sales">Sales</SelectItem>
                                    <SelectItem value="callcenter">Call Center</SelectItem>
                                    <SelectItem value="property">Property</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={formData.roleId} onValueChange={v => setFormData({ ...formData, roleId: v })}>
                                <SelectTrigger><SelectValue placeholder="Select Role" /></SelectTrigger>
                                <SelectContent>
                                    {roles.map(r => (
                                        <SelectItem key={r._id} value={r._id}>{r.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Reports To (Manager)</Label>
                            <Select value={formData.reportsTo || "none"} onValueChange={v => setFormData({ ...formData, reportsTo: v })}>
                                <SelectTrigger><SelectValue placeholder="Select Manager" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Manager</SelectItem>
                                    {users.filter(u => u._id !== editingUser?._id).map(u => (
                                        <SelectItem key={u._id} value={u._id}>{u.name} ({u.teamType})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="submit" className="w-full">Save</Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Card>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Team</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Manager</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map(user => (
                                <TableRow key={user._id}>
                                    <TableCell>{user.name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>{user.teamType}</TableCell>
                                    <TableCell>{roles.find(r => r._id === user.roleId)?.name || "-"}</TableCell>
                                    <TableCell>{users.find(u => u._id === user.reportsTo)?.name || "-"}</TableCell>
                                    <TableCell>
                                        <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>Edit</Button>
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
