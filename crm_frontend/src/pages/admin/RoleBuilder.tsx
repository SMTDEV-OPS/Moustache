import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Role, listRoles, createRole, updateRole, deleteRole, listUsersForRole } from "@/services/roles";
import { Shield, Trash2, Edit, Edit2, Plus, Users, Loader2 } from "lucide-react";

interface RoleNodeProps {
    role: Role;
    allRoles: Role[];
    expandedRoles: Set<string>;
    toggleExpand: (roleId: string) => void;
    selectedRoleId: string | null;
    onSelect: (roleId: string) => void;
    onAddChild: (parentRoleId: string) => void;
    onEditRole: (role: Role) => void;
    onDeleteRole: (role: Role) => void;
}

const RoleNodeComponent = ({
    role,
    allRoles,
    expandedRoles,
    toggleExpand,
    selectedRoleId,
    onSelect,
    onAddChild,
    onEditRole,
    onDeleteRole,
}: RoleNodeProps) => {
    const [hovered, setHovered] = useState(false);

    const children = useMemo(
        () => allRoles.filter((r) => r.parentRoleId === role.id),
        [allRoles, role.id]
    );

    const hasChildren = children.length > 0;
    const isExpanded = expandedRoles.has(role.id);
    const isSelected = selectedRoleId === role.id;

    return (
        <div className="flex flex-col">
            <div
                className="flex items-center py-1.5"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                {/* Expand/Collapse Toggle */}
                <div className="flex items-center justify-center w-5 mr-1 flex-shrink-0">
                    {hasChildren ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(role.id);
                            }}
                            className="w-3.5 h-3.5 border border-blue-500 rounded-sm flex items-center justify-center focus:outline-none text-blue-600 hover:bg-blue-50"
                        >
                            <span className="text-[10px] leading-none font-bold">
                                {isExpanded ? "-" : "+"}
                            </span>
                        </button>
                    ) : (
                        <div className="w-3.5 h-3.5 border border-gray-300 rounded-sm bg-gray-50 flex items-center justify-center">
                            <span className="text-[10px] leading-none text-gray-400">•</span>
                        </div>
                    )}
                </div>

                {/* Role Name - click to select */}
                <div
                    onClick={() => onSelect(role.id)}
                    className={`cursor-pointer px-2 py-0.5 rounded text-sm transition-colors select-none ${isSelected
                        ? 'text-blue-700 bg-blue-50 border border-blue-200 font-medium'
                        : 'text-gray-700 hover:bg-gray-100 border border-transparent'
                        }`}
                >
                    {role.name}
                </div>

                {/* Inline actions — always rendered, opacity toggled so mouse can reach buttons without flicker */}
                <div
                    className="flex items-center ml-2 space-x-0.5"
                    style={{ opacity: hovered ? 1 : 0, pointerEvents: hovered ? 'auto' : 'none', transition: 'opacity 0.1s' }}
                >
                    <button
                        title="Add Child Role"
                        onClick={(e) => { e.stopPropagation(); onAddChild(role.id); }}
                        className="p-1 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                        title="Edit Role"
                        onClick={(e) => { e.stopPropagation(); onSelect(role.id); onEditRole(role); }}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        title="Delete Role"
                        onClick={(e) => { e.stopPropagation(); onDeleteRole(role); }}
                        className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {
                isExpanded && hasChildren && (
                    <div className="ml-2.5 pl-4 border-l border-dashed border-gray-300">
                        {children.map((child) => (
                            <RoleNodeComponent
                                key={child.id}
                                role={child}
                                allRoles={allRoles}
                                expandedRoles={expandedRoles}
                                toggleExpand={toggleExpand}
                                selectedRoleId={selectedRoleId}
                                onSelect={onSelect}
                                onAddChild={onAddChild}
                                onEditRole={onEditRole}
                                onDeleteRole={onDeleteRole}
                            />
                        ))}
                    </div>
                )
            }
        </div >
    );
};

export const RoleBuilder = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const { toast } = useToast();

    const [roleName, setRoleName] = useState("");
    const [roleDescription, setRoleDescription] = useState("");
    const [parentRoleId, setParentRoleId] = useState<string>("none");

    const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

    // Right Pane State
    const [usersInRole, setUsersInRole] = useState<number>(0);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    // Delete Confirmation State
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

    const fetchRoles = async () => {
        try {
            const data = await listRoles();
            setRoles(data);

            if (expandedRoles.size === 0 && data.length > 0) {
                const parents = new Set(data.map(r => r.parentRoleId).filter(Boolean) as string[]);
                setExpandedRoles(parents);
            }
        } catch (err) {
            toast({ title: "Error", description: "Failed to fetch roles", variant: "destructive" });
        }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    const selectedRole = useMemo(() => {
        return roles.find(r => r.id === selectedRoleId) || null;
    }, [roles, selectedRoleId]);

    const parentOfSelected = useMemo(() => {
        if (!selectedRole || !selectedRole.parentRoleId) return null;
        return roles.find(r => r.id === selectedRole.parentRoleId) || null;
    }, [roles, selectedRole]);

    useEffect(() => {
        if (selectedRoleId) {
            setIsLoadingUsers(true);
            listUsersForRole(selectedRoleId)
                .then(users => setUsersInRole(users.length))
                .catch(() => setUsersInRole(0))
                .finally(() => setIsLoadingUsers(false));
        }
    }, [selectedRoleId]);

    const toggleExpand = (roleId: string) => {
        const newExpanded = new Set(expandedRoles);
        if (newExpanded.has(roleId)) {
            newExpanded.delete(roleId);
        } else {
            newExpanded.add(roleId);
        }
        setExpandedRoles(newExpanded);
    };

    const expandAll = () => {
        const parents = new Set(roles.map(r => r.parentRoleId).filter(Boolean) as string[]);
        setExpandedRoles(parents);
    };

    const collapseAll = () => {
        setExpandedRoles(new Set());
    };

    const handleEditSelected = () => {
        if (!selectedRole) return;
        setEditingRole(selectedRole);
        setRoleName(selectedRole.name);
        setRoleDescription(selectedRole.description || "");
        setParentRoleId(selectedRole.parentRoleId || "none");
        setIsDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingRole(null);
        setRoleName("");
        setRoleDescription("");
        setParentRoleId(selectedRoleId || "none");
        setIsDialogOpen(true);
    };

    const handleDeleteSelected = () => {
        if (!selectedRole) return;
        setRoleToDelete(selectedRole);
        setIsDeleteDialogOpen(true);
    };

    // Called from inline + icon in tree node
    const handleAddChild = (parentId: string) => {
        setEditingRole(null);
        setRoleName("");
        setRoleDescription("");
        setParentRoleId(parentId);
        setIsDialogOpen(true);
    };

    // Called from inline edit icon in tree node
    const handleInlineEdit = (role: Role) => {
        setEditingRole(role);
        setRoleName(role.name);
        setRoleDescription(role.description || "");
        setParentRoleId(role.parentRoleId || "none");
        setIsDialogOpen(true);
    };

    // Called from inline delete icon in tree node
    const handleInlineDelete = (role: Role) => {
        setRoleToDelete(role);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!roleToDelete) return;
        try {
            await deleteRole(roleToDelete.id);
            toast({ title: "Success", description: "Role deleted successfully" });
            if (selectedRoleId === roleToDelete.id) {
                setSelectedRoleId(null);
            }
            fetchRoles();
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to delete role", variant: "destructive" });
        } finally {
            setIsDeleteDialogOpen(false);
            setRoleToDelete(null);
        }
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
                toast({ title: "Success", description: "Role updated" });
            } else {
                const newRole = await createRole(payload);
                toast({ title: "Success", description: "Role created" });
                if (payload.parentRoleId) {
                    setExpandedRoles(prev => new Set(prev).add(payload.parentRoleId as string));
                }
                setSelectedRoleId(newRole.id); // Auto select new role
            }

            setIsDialogOpen(false);
            fetchRoles();
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to save role", variant: "destructive" });
        }
    };

    const rootRoles = useMemo(() => {
        const roleIds = new Set(roles.map(r => r.id));
        return roles.filter(r => !r.parentRoleId || !roleIds.has(r.parentRoleId));
    }, [roles]);

    return (
        <div className="p-6 max-w-[1400px] mx-auto min-h-screen bg-[#F8FAFC]">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
                <p className="text-sm text-gray-500 mt-1">
                    This page will allow you to define how you share the data among users based on your organization's role hierarchy. For more information, refer to online help.
                </p>
            </div>

            <div className="flex border border-gray-200 bg-white rounded-md shadow-sm h-[calc(100vh-200px)] min-h-[500px]">
                {/* Left Pane - Tree */}
                <div className="w-1/3 min-w-[300px] max-w-[400px] border-r border-gray-200 flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <Button onClick={handleCreate} className="bg-[#4169E1] hover:bg-blue-700 h-8 px-4 text-xs font-semibold rounded-md text-white">
                            New Role
                        </Button>
                        <div className="flex items-center space-x-2 text-xs text-blue-500">
                            <button onClick={expandAll} className="hover:underline">Expand All</button>
                            <span className="text-gray-300">|</span>
                            <button onClick={collapseAll} className="hover:underline">Collapse All</button>
                        </div>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto">
                        {roles.length === 0 ? (
                            <div className="text-center py-8 text-sm text-gray-400">
                                No roles defined.
                            </div>
                        ) : (
                            <div className="pl-2">
                                {rootRoles.map(rootRole => (
                                    <RoleNodeComponent
                                        key={rootRole.id}
                                        role={rootRole}
                                        allRoles={roles}
                                        expandedRoles={expandedRoles}
                                        toggleExpand={toggleExpand}
                                        selectedRoleId={selectedRoleId}
                                        onSelect={(id) => setSelectedRoleId(prev => prev === id ? null : id)}
                                        onAddChild={handleAddChild}
                                        onEditRole={handleInlineEdit}
                                        onDeleteRole={handleInlineDelete}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Pane - Details */}
                <div className="flex-1 overflow-y-auto p-8 relative">
                    {!selectedRole ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                            <Shield className="w-16 h-16 text-gray-200 mb-4" />
                            <p className="text-sm">Select a role from the hierarchy to view details</p>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in duration-200">
                            {/* Header row */}
                            <div className="flex justify-between items-start border-b border-gray-100 pb-6">
                                <div className="flex items-start tracking-tight">
                                    <div className="w-12 h-12 bg-blue-100/50 rounded-lg flex items-center justify-center text-blue-600 mr-4">
                                        <Shield className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">{selectedRole.name}</h2>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {selectedRole.description || "No description provided."}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex space-x-3">
                                    <Button variant="outline" onClick={handleEditSelected} className="h-9 px-4 text-xs font-semibold">
                                        <Edit className="w-3.5 h-3.5 mr-2" />
                                        Edit Role
                                    </Button>
                                    <Button variant="destructive" onClick={handleDeleteSelected} className="h-9 px-4 text-xs font-semibold bg-red-500 hover:bg-red-600">
                                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                                        Delete
                                    </Button>
                                </div>
                            </div>

                            {/* Info Blocks */}
                            <div className="grid grid-cols-2 gap-8">
                                {/* Hierarchy Setup */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-4">
                                        Hierarchy Setup
                                    </h3>
                                    <div className="border border-gray-200 rounded text-sm bg-white shadow-sm">
                                        <div className="flex justify-between border-b border-gray-100 px-4 py-3">
                                            <span className="text-gray-500">Reports To</span>
                                            <span className="font-medium text-gray-900">
                                                {parentOfSelected ? parentOfSelected.name : "Top Level (No Parent)"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between px-4 py-3">
                                            <span className="text-gray-500">Share Data with Peers</span>
                                            <span className="flex items-center text-gray-900 font-medium">
                                                <span className="w-2 h-2 rounded-full bg-gray-300 mr-2"></span>
                                                Disabled
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Users in Role */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-4">
                                        Users In Role
                                    </h3>
                                    <div className="border border-gray-200 rounded min-h-[100px] flex flex-col items-center justify-center bg-white shadow-sm py-6">
                                        {isLoadingUsers ? (
                                            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                                        ) : (
                                            <>
                                                <Users className="w-8 h-8 text-gray-300 mb-2" />
                                                <span className="text-2xl font-bold text-gray-900">
                                                    {usersInRole}
                                                </span>
                                                <span className="text-xs text-gray-500 mt-1">users assigned</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Create / Edit Dialog */}
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
                                        if (editingRole && editingRole.id === r.id) return null;
                                        return (
                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
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

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Role</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the role "{roleToDelete?.name}"?
                            This action cannot be undone. Users currently holding this role may lose access to data.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Delete Role</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
