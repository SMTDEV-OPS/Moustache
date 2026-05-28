import { useState, useEffect } from "react";
import { Plus, Search, ShieldAlert, ArrowLeft, Loader2, Save, Trash2, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { RoleTreeNode } from "./RoleTreeNode";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";

interface RoleTreeItem {
    _id: string;
    name: string;
    description?: string;
    parentRoleId?: string;
    shareDataWithPeers: boolean;
    isSystemRole?: boolean;
    children: RoleTreeItem[];
    userCount?: number;
}

export function RolesManager() {
    const [rolesTree, setRolesTree] = useState<RoleTreeItem[]>([]);
    const [flatRoles, setFlatRoles] = useState<RoleTreeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState<RoleTreeItem | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isExpandedAll, setIsExpandedAll] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        parentRoleId: "",
        shareDataWithPeers: false,
    });

    const { toast } = useToast();

    const fetchRoles = async () => {
        setIsLoading(true);
        try {
            // Fetch Tree
            const treeRes = await fetch(`${API_BASE_URL}/roles/tree`, {
                headers: withAuthHeaders()
            });
            if (treeRes.ok) {
                const data = await treeRes.json();
                setRolesTree(data);
            }

            // Fetch Flat List (for parent selection dropdown)
            const flatRes = await fetch(`${API_BASE_URL}/roles`, {
                headers: withAuthHeaders()
            });
            if (flatRes.ok) {
                const data = await flatRes.json();
                setFlatRoles(data);
            }
        } catch (error) {
            console.error("Failed to fetch roles:", error);
            toast({ title: "Error", description: "Failed to load roles hierarchy.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    const handleSelectRole = (role: RoleTreeItem) => {
        setSelectedRole(role);
        setIsEditing(false);
        setFormData({
            name: role.name,
            description: role.description || "",
            parentRoleId: role.parentRoleId || "",
            shareDataWithPeers: role.shareDataWithPeers || false,
        });
    };

    const handleCreateNew = () => {
        setSelectedRole(null);
        setIsEditing(true);
        setFormData({
            name: "",
            description: "",
            parentRoleId: selectedRole?._id || "", // Default to currently selected role as parent
            shareDataWithPeers: false,
        });
    };

    const handleSave = async () => {
        if (!formData.name) {
            toast({ title: "Validation Error", description: "Role name is required.", variant: "destructive" });
            return;
        }

        try {
            const isNew = !selectedRole;
            const url = isNew ? `${API_BASE_URL}/roles` : `${API_BASE_URL}/roles/${selectedRole._id}`;
            const method = isNew ? 'POST' : 'PATCH';

            const payload = { ...formData };
            if (!payload.parentRoleId) delete (payload as any).parentRoleId;

            const res = await fetch(url, {
                method,
                headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to save role");
            }

            toast({ title: "Success", description: `Role ${isNew ? 'created' : 'updated'} successfully.` });
            await fetchRoles();
            setIsEditing(false);

            if (isNew) {
                const newRole = await res.json();
                setSelectedRole(newRole);
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleDelete = async () => {
        if (!selectedRole) return;
        if (selectedRole.isSystemRole) {
            toast({ title: "Restricted", description: "System roles cannot be deleted.", variant: "destructive" });
            return;
        }

        if (!confirm(`Are you sure you want to delete the role '${selectedRole.name}'?`)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/roles/${selectedRole._id}`, {
                method: 'DELETE',
                headers: withAuthHeaders()
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to delete role");
            }

            toast({ title: "Success", description: "Role deleted successfully." });
            setSelectedRole(null);
            await fetchRoles();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    // Prevent selecting oneself or a descendant as a parent
    const getSelectableParents = () => {
        if (!selectedRole) return flatRoles;

        // Hacky way to filter descendants: don't allow setting parent to anyone right now if editing an existing node
        // In a real robust system, we'd recursively remove descendants from this list.
        // For simplicity in Zoho, you often can't reparent easily or you just filter out the current node.
        return flatRoles.filter(r => r._id !== selectedRole._id);
    };

    if (isLoading && rolesTree.length === 0) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 border-b -mx-6 -mt-6 mb-6">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Roles</h2>
                    <p className="text-sm text-muted-foreground mt-1">This page will allow you to define how you share the data among users based on your organization's role hierarchy. For more information, refer to online help.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel: Tree View */}
                <div className="lg:col-span-1 h-[calc(100vh-220px)] flex flex-col pl-2">
                    <div className="flex gap-4 mb-6">
                        {!isEditing && (
                            <Button onClick={handleCreateNew} className="bg-[#4a72d4] hover:bg-[#3b5ebb] h-8 text-sm px-4">
                                New Role
                            </Button>
                        )}
                        <div className="flex items-center text-sm text-blue-500 gap-2">
                            <span
                                className="cursor-pointer hover:underline"
                                onClick={() => setIsExpandedAll(true)}
                            >
                                Expand All
                            </span>
                            <span className="text-gray-300">|</span>
                            <span
                                className="cursor-pointer hover:underline"
                                onClick={() => setIsExpandedAll(false)}
                            >
                                Collapse All
                            </span>
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 pb-10">
                        {rolesTree.length === 0 ? (
                            <div className="text-center p-6 text-muted-foreground text-sm">No roles found.</div>
                        ) : (
                            <div className="space-y-1">
                                {rolesTree.map(node => (
                                    <RoleTreeNode
                                        key={node._id}
                                        node={node}
                                        selectedRoleId={selectedRole?._id || null}
                                        onSelect={handleSelectRole}
                                        isExpandedAll={isExpandedAll}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Details / Editor */}
                <Card className="lg:col-span-2 border-border/50 shadow-sm h-[calc(100vh-220px)] overflow-y-auto border-l lg:border-l-0">
                    {isEditing ? (
                        // EDIT MODE
                        <>
                            <CardHeader className="border-b bg-muted/5 p-4 flex flex-row items-center justify-between sticky top-0 z-10">
                                <div className="flex items-center gap-3">
                                    <Button variant="ghost" size="icon" onClick={() => { setIsEditing(false); if (!selectedRole) setSelectedRole(null); }} className="h-8 w-8">
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                    <div>
                                        <CardTitle className="text-lg">{selectedRole ? 'Edit Role' : 'Create New Role'}</CardTitle>
                                        <CardDescription>Configure role details and hierarchy placement.</CardDescription>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => { setIsEditing(false); if (!selectedRole) setSelectedRole(null); }}>Cancel</Button>
                                    <Button onClick={handleSave} className="gap-2"><Save className="h-4 w-4" /> Save</Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6 max-w-2xl">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Role Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Sales Manager"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="parent">Reports To</Label>
                                    <select
                                        id="parent"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={formData.parentRoleId}
                                        onChange={(e) => setFormData({ ...formData, parentRoleId: e.target.value })}
                                        disabled={selectedRole?.isSystemRole && !selectedRole.parentRoleId} // Cannot reparent the top root role easily
                                    >
                                        <option value="">-- Top Level (No Parent) --</option>
                                        {getSelectableParents().map(r => (
                                            <option key={r._id} value={r._id}>{r.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground">The user in this role will report to the user in the selected Role.</p>
                                </div>

                                <div className="space-y-4 pt-2 border-t mt-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Share Data with Peers</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Allows users in this role to view each other's data (if default module access is Private).
                                            </p>
                                        </div>
                                        <Switch
                                            checked={formData.shareDataWithPeers}
                                            onCheckedChange={(c) => setFormData({ ...formData, shareDataWithPeers: c })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t mt-6">
                                    <Label htmlFor="desc">Description</Label>
                                    <Textarea
                                        id="desc"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Brief description of this role's responsibilities..."
                                        rows={3}
                                    />
                                </div>
                            </CardContent>
                        </>
                    ) : selectedRole ? (
                        // VIEW MODE
                        <>
                            <CardHeader className="border-b bg-muted/5 p-6 flex flex-row justify-between items-start">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-blue-100 text-blue-700 rounded-xl mt-1">
                                        <ShieldCheck className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <CardTitle className="text-2xl">{selectedRole.name}</CardTitle>
                                            {selectedRole.isSystemRole && (
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">System</span>
                                            )}
                                        </div>
                                        <CardDescription className="text-base text-gray-600">
                                            {selectedRole.description || "No description provided."}
                                        </CardDescription>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setIsEditing(true)}>Edit Role</Button>
                                    {!selectedRole.isSystemRole && (
                                        <Button variant="destructive" onClick={handleDelete} className="gap-2">
                                            <Trash2 className="h-4 w-4" /> Delete
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Hierarchy Setup</h4>
                                            <div className="bg-gray-50 p-4 rounded-lg border">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-sm text-gray-600">Reports To</span>
                                                    <span className="font-medium">
                                                        {selectedRole.parentRoleId ? flatRoles.find(r => r._id === selectedRole.parentRoleId)?.name || "Unknown Parent" : "— (Top Level)"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between border-t pt-3">
                                                    <span className="text-sm text-gray-600">Share Data with Peers</span>
                                                    <span className="font-medium flex items-center gap-1.5">
                                                        {selectedRole.shareDataWithPeers ? (
                                                            <><div className="w-2 h-2 rounded-full bg-green-500"></div> Enabled</>
                                                        ) : (
                                                            <><div className="w-2 h-2 rounded-full bg-gray-300"></div> Disabled</>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Users in Role</h4>
                                        <div className="bg-white border rounded-lg p-4 flex flex-col items-center justify-center text-center h-32">
                                            <Users className="h-8 w-8 text-gray-300 mb-2" />
                                            <p className="text-lg font-semibold">{selectedRole.userCount || 0}</p>
                                            <p className="text-sm text-muted-foreground">users assigned</p>
                                        </div>
                                    </div>
                                </div>

                                {selectedRole.isSystemRole && (
                                    <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                                        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="text-sm text-amber-800">
                                            <strong>System Role:</strong> This is a core organizational role. It cannot be deleted or completely re-parented out of the root hierarchy to ensure system stability.
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </>
                    ) : (
                        // EMPTY STATE
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <Users className="h-8 w-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-1">Select a Role</h3>
                            <p className="text-sm max-w-sm">Select a role from the hierarchy tree on the left to view its details, or create a new role.</p>
                            <Button onClick={handleCreateNew} variant="outline" className="mt-6 gap-2">
                                <Plus className="h-4 w-4" /> Create New Role
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
