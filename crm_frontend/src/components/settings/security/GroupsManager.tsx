import { useState, useEffect } from "react";
import { Plus, Search, Users, X, User, ShieldCheck, FolderGit2, Loader2, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";

// Basic common types
interface CommonRef { _id: string; name: string; }

interface Group {
    _id: string;
    name: string;
    description: string;
    memberUserIds: CommonRef[];
    memberRoleIds: CommonRef[];
    subGroupIds: CommonRef[];
    includeSubordinates: boolean;
    memberCount?: number;
}

export function GroupsManager() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Editor Slideout State
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Partial<Group> | null>(null);
    const [previewMembers, setPreviewMembers] = useState<{ users: CommonRef[], totalCount: number } | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    // Dependencies for dropdowns
    const [allUsers, setAllUsers] = useState<CommonRef[]>([]);
    const [allRoles, setAllRoles] = useState<CommonRef[]>([]);

    // Quick Add selectors
    const [selectedUserToAdd, setSelectedUserToAdd] = useState("");
    const [selectedRoleToAdd, setSelectedRoleToAdd] = useState("");
    const [selectedGroupToAdd, setSelectedGroupToAdd] = useState("");

    const { toast } = useToast();

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const [grpRes, usrRes, rolRes] = await Promise.all([
                fetch(`${API_BASE_URL}/groups`, { headers: withAuthHeaders() }),
                fetch(`${API_BASE_URL}/users`, { headers: withAuthHeaders() }),
                fetch(`${API_BASE_URL}/roles`, { headers: withAuthHeaders() })
            ]);

            if (grpRes.ok) setGroups(await grpRes.json());
            if (usrRes.ok) {
                const ud = await usrRes.json();
                setAllUsers(ud.users || ud);
            }
            if (rolRes.ok) setAllRoles(await rolRes.json());

        } catch (error) {
            toast({ title: "Error", description: "Failed to load groups data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    // Load Preview Members
    useEffect(() => {
        if (!editingGroup || !editingGroup._id) {
            setPreviewMembers(null);
            return;
        }
        const loadPreview = async () => {
            setIsPreviewLoading(true);
            try {
                const res = await fetch(`${API_BASE_URL}/groups/${editingGroup._id}/members/preview`, {
                    headers: withAuthHeaders()
                });
                if (res.ok) {
                    const data = await res.json();
                    setPreviewMembers(data);
                }
            } catch (e) { /* ignore */ }
            finally { setIsPreviewLoading(false); }
        };
        loadPreview();
    }, [editingGroup?._id, isSheetOpen]);

    const handleCreateNew = () => {
        setEditingGroup({
            name: "",
            description: "",
            memberUserIds: [],
            memberRoleIds: [],
            subGroupIds: [],
            includeSubordinates: false
        });
        setSelectedUserToAdd("");
        setSelectedRoleToAdd("");
        setSelectedGroupToAdd("");
        setIsSheetOpen(true);
    };

    const handleEdit = (group: Group) => {
        // Deep copy
        setEditingGroup(JSON.parse(JSON.stringify(group)));
        setSelectedUserToAdd("");
        setSelectedRoleToAdd("");
        setSelectedGroupToAdd("");
        setIsSheetOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete the group '${name}'?`)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/groups/${id}`, {
                method: 'DELETE',
                headers: withAuthHeaders()
            });
            if (!res.ok) throw new Error("Failed to delete group");
            toast({ title: "Success", description: "Group deleted." });
            setGroups(groups.filter(g => g._id !== id));
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleSave = async () => {
        if (!editingGroup?.name) {
            toast({ title: "Validation Error", description: "Group name is required.", variant: "destructive" });
            return;
        }

        try {
            const isNew = !editingGroup._id;
            const url = isNew ? `${API_BASE_URL}/groups` : `${API_BASE_URL}/groups/${editingGroup._id}`;
            const method = isNew ? 'POST' : 'PUT';

            // Map refs to IDs for backend payload
            const payload = {
                name: editingGroup.name,
                description: editingGroup.description,
                includeSubordinates: editingGroup.includeSubordinates,
                memberUserIds: editingGroup.memberUserIds?.map(u => u._id) || [],
                memberRoleIds: editingGroup.memberRoleIds?.map(r => r._id) || [],
                subGroupIds: editingGroup.subGroupIds?.map(g => g._id) || []
            };

            const res = await fetch(url, {
                method,
                headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to save group");
            }

            toast({ title: "Success", description: `Group ${isNew ? 'created' : 'updated'}.` });
            setIsSheetOpen(false);

            // Refresh list
            const grpRes = await fetch(`${API_BASE_URL}/groups`, { headers: withAuthHeaders() });
            if (grpRes.ok) setGroups(await grpRes.json());

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    // Member Array Helpers
    const addMember = (type: 'user' | 'role' | 'group', id: string) => {
        if (!id || !editingGroup) return;
        if (type === 'user') {
            if (editingGroup.memberUserIds!.some(u => u._id === id)) return;
            const ref = allUsers.find(u => u._id === id);
            if (ref) setEditingGroup({ ...editingGroup, memberUserIds: [...editingGroup.memberUserIds!, ref] });
            setSelectedUserToAdd("");
        }
        else if (type === 'role') {
            if (editingGroup.memberRoleIds!.some(r => r._id === id)) return;
            const ref = allRoles.find(r => r._id === id);
            if (ref) setEditingGroup({ ...editingGroup, memberRoleIds: [...editingGroup.memberRoleIds!, ref] });
            setSelectedRoleToAdd("");
        }
        else if (type === 'group') {
            if (editingGroup.subGroupIds!.some(g => g._id === id)) return;
            const ref = groups.find(g => g._id === id);
            if (ref) setEditingGroup({ ...editingGroup, subGroupIds: [...editingGroup.subGroupIds!, ref] });
            setSelectedGroupToAdd("");
        }
    };

    const removeMember = (type: 'user' | 'role' | 'group', id: string) => {
        if (!editingGroup) return;
        if (type === 'user') setEditingGroup({ ...editingGroup, memberUserIds: editingGroup.memberUserIds!.filter(u => u._id !== id) });
        if (type === 'role') setEditingGroup({ ...editingGroup, memberRoleIds: editingGroup.memberRoleIds!.filter(r => r._id !== id) });
        if (type === 'group') setEditingGroup({ ...editingGroup, subGroupIds: editingGroup.subGroupIds!.filter(g => g._id !== id) });
    };

    const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (isLoading && groups.length === 0) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Employee Groups</h2>
                    <p className="text-muted-foreground">Manage collaborative teams across different roles and regions.</p>
                </div>
                <Button onClick={handleCreateNew} className="gap-2">
                    <Plus className="h-4 w-4" /> New Group
                </Button>
            </div>

            <Card className="border-border/50 shadow-sm">
                <CardHeader className="p-4 border-b bg-muted/10 pb-3 block">
                    <div className="relative w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search groups..."
                            className="pl-9 bg-background"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-sm font-semibold text-gray-700">
                    <div className="col-span-3">Group Name</div>
                    <div className="col-span-5">Description</div>
                    <div className="col-span-2 text-center">Configured Members</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>
                <div className="divide-y">
                    {filteredGroups.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">No groups found.</div>
                    ) : (
                        filteredGroups.map(g => (
                            <div key={g._id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 transition-colors">
                                <div className="col-span-3 font-medium flex items-center gap-2">
                                    <FolderGit2 className="h-4 w-4 text-purple-600" />
                                    {g.name}
                                </div>
                                <div className="col-span-5 text-sm text-muted-foreground truncate">
                                    {g.description || "—"}
                                </div>
                                <div className="col-span-2 text-center text-sm">
                                    {g.memberCount} elements
                                </div>
                                <div className="col-span-2 text-right flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(g)}>Edit</Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(g._id, g.name)} className="text-red-600 hover:text-red-700 hover:bg-red-50">Delete</Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="sm:max-w-xl md:max-w-2xl px-6 py-6 overflow-y-auto">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-2xl">{editingGroup?._id ? "Edit Group" : "Create New Group"}</SheetTitle>
                        <SheetDescription>
                            Configure group properties and add members. A group can contain specific users, entire roles, or other subgroups.
                        </SheetDescription>
                    </SheetHeader>

                    {editingGroup && (
                        <div className="space-y-8">
                            {/* Basic Details */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Group Details</h3>
                                <div className="space-y-2">
                                    <Label>Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={editingGroup.name}
                                        onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                        placeholder="e.g. Europe Sales Team"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Textarea
                                        value={editingGroup.description}
                                        onChange={e => setEditingGroup({ ...editingGroup, description: e.target.value })}
                                        rows={2}
                                    />
                                </div>
                            </div>

                            {/* Member Pickers */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Add Members</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Add Users */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Add Users</Label>
                                        <div className="flex gap-2">
                                            <select
                                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                value={selectedUserToAdd}
                                                onChange={e => setSelectedUserToAdd(e.target.value)}
                                            >
                                                <option value="">Select User...</option>
                                                {allUsers.filter(u => !editingGroup.memberUserIds?.some(m => m._id === u._id)).map(u => (
                                                    <option key={u._id} value={u._id}>{u.name}</option>
                                                ))}
                                            </select>
                                            <Button size="sm" className="h-9 px-3" onClick={() => addMember('user', selectedUserToAdd)}>Add</Button>
                                        </div>
                                    </div>

                                    {/* Add Subgroups */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Add Sub-Groups</Label>
                                        <div className="flex gap-2">
                                            <select
                                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                value={selectedGroupToAdd}
                                                onChange={e => setSelectedGroupToAdd(e.target.value)}
                                            >
                                                <option value="">Select Group...</option>
                                                {groups.filter(g => g._id !== editingGroup._id && !editingGroup.subGroupIds?.some(m => m._id === g._id)).map(g => (
                                                    <option key={g._id} value={g._id}>{g.name}</option>
                                                ))}
                                            </select>
                                            <Button size="sm" className="h-9 px-3" onClick={() => addMember('group', selectedGroupToAdd)}>Add</Button>
                                        </div>
                                    </div>

                                    {/* Add Roles */}
                                    <div className="space-y-1.5 md:col-span-2">
                                        <Label className="text-xs">Add Roles</Label>
                                        <div className="flex gap-2">
                                            <select
                                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                value={selectedRoleToAdd}
                                                onChange={e => setSelectedRoleToAdd(e.target.value)}
                                            >
                                                <option value="">Select Role...</option>
                                                {allRoles.filter(r => !editingGroup.memberRoleIds?.some(m => m._id === r._id)).map(r => (
                                                    <option key={r._id} value={r._id}>{r.name}</option>
                                                ))}
                                            </select>
                                            <Button size="sm" className="h-9 px-3" onClick={() => addMember('role', selectedRoleToAdd)}>Add</Button>
                                        </div>
                                        <div className="flex items-center space-x-2 pt-1 border p-2 rounded-md bg-muted/20">
                                            <Checkbox
                                                id="subords"
                                                checked={editingGroup.includeSubordinates}
                                                onCheckedChange={(c) => setEditingGroup({ ...editingGroup, includeSubordinates: c === true })}
                                            />
                                            <label htmlFor="subords" className="text-xs font-medium cursor-pointer">
                                                Include users in Subordinate Roles for all selected Roles above
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Current Configuration List */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Current Configuration</h3>
                                <div className="p-4 border rounded-md bg-gray-50/50 min-h-24">
                                    <div className="flex flex-wrap gap-2">
                                        {editingGroup.memberUserIds?.map(u => (
                                            <div key={`u-${u._id}`} className="flex items-center gap-1.5 bg-blue-100/80 text-blue-800 px-2.5 py-1 rounded-full text-xs font-medium border border-blue-200">
                                                <User className="w-3.5 h-3.5" />
                                                {u.name}
                                                <button onClick={() => removeMember('user', u._id)} className="ml-1 hover:text-red-500 outline-none"><X className="w-3.5 h-3.5" /></button>
                                            </div>
                                        ))}
                                        {editingGroup.memberRoleIds?.map(r => (
                                            <div key={`r-${r._id}`} className="flex items-center gap-1.5 bg-green-100/80 text-green-800 px-2.5 py-1 rounded-full text-xs font-medium border border-green-200">
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                {r.name}
                                                <button onClick={() => removeMember('role', r._id)} className="ml-1 hover:text-red-500 outline-none"><X className="w-3.5 h-3.5" /></button>
                                            </div>
                                        ))}
                                        {editingGroup.subGroupIds?.map(g => (
                                            <div key={`g-${g._id}`} className="flex items-center gap-1.5 bg-purple-100/80 text-purple-800 px-2.5 py-1 rounded-full text-xs font-medium border border-purple-200">
                                                <FolderGit2 className="w-3.5 h-3.5" />
                                                {g.name}
                                                <button onClick={() => removeMember('group', g._id)} className="ml-1 hover:text-red-500 outline-none"><X className="w-3.5 h-3.5" /></button>
                                            </div>
                                        ))}
                                        {(!editingGroup.memberUserIds?.length && !editingGroup.memberRoleIds?.length && !editingGroup.subGroupIds?.length) && (
                                            <span className="text-muted-foreground text-sm italic">No members configured yet.</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Resolved Members Preview (Read Only) */}
                            {editingGroup._id && (
                                <div className="space-y-3 pt-4 border-t">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Resolved Members Preview</h3>
                                        {isPreviewLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                    </div>
                                    <div className="bg-white border rounded-md p-4 mt-2 max-h-48 overflow-y-auto">
                                        {previewMembers ? (
                                            <>
                                                <p className="text-sm font-medium mb-3">Total Users Covered: {previewMembers.totalCount}</p>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                    {(previewMembers.users || []).map(u => (
                                                        <div key={u._id} className="text-xs bg-gray-50 p-1.5 rounded border truncate text-gray-700">
                                                            👤 {u.name}
                                                        </div>
                                                    ))}
                                                </div>
                                                {previewMembers.totalCount === 0 && <span className="text-sm text-muted-foreground">This group currently resolves to 0 active users.</span>}
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground italic text-center">Save the group to preview resolved members.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>
                    )}

                    <SheetFooter className="mt-8 border-t pt-6 bg-white sm:sticky sm:bottom-0 z-10 w-[calc(100%+3rem)] -ml-6 px-6 -mb-6 h-20">
                        <Button variant="outline" onClick={() => setIsSheetOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} className="gap-2"><Save className="h-4 w-4" /> Save Group</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}
