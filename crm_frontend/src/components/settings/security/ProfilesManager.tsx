import { useState, useEffect } from "react";
import { Plus, Search, ShieldCheck, ArrowLeft, Loader2, Save, Trash2, Copy, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { PermissionsTable } from "./PermissionsTable";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";

// Must match backend — used to fill in defaults when profile has empty arrays
const ALL_MODULES = [
  "leads", "users", "roles", "reports", "accounts", "contacts",
  "properties", "tasks", "tickets", "guests", "reservations",
  "communications", "quotations", "payment-links", "workflows",
  "templates", "knowledge-base", "pms", "regions", "groups",
  "assignment-rules", "notifications", "email", "buddies",
];

const ALL_SETUP_KEYS = [
  "settings.manage", "users.manage", "roles.manage", "reports.manage",
  "groups.manage", "regions.manage", "assignment-rules.manage",
  "workflows.manage", "templates.manage", "knowledge-base.manage",
  "pms.manage", "notifications.manage", "buddies.manage",
  "conglomerates.manage", "account-potentials.manage", "hotel-brands.manage",
];

function mergeModulePermissions(saved: ModulePermission[] | undefined): ModulePermission[] {
  return ALL_MODULES.map((module) => {
    const existing = (saved || []).find((p) => p.module === module);
    return (
      existing || {
        module,
        view: false,
        create: false,
        edit: false,
        delete: false,
      }
    );
  });
}

function mergeSetupPermissions(saved: SetupPermission[] | undefined): SetupPermission[] {
  return ALL_SETUP_KEYS.map((key) => {
    const existing = (saved || []).find((p) => p.key === key);
    return existing || { key, enabled: false };
  });
}

interface ModulePermission {
    module: string;
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
}

interface SetupPermission {
    key: string;
    enabled: boolean;
}

interface Profile {
    _id: string;
    name: string;
    description: string;
    isSystemProfile: boolean;
    modulePermissions: ModulePermission[];
    setupPermissions: SetupPermission[];
    clonedFrom?: { _id: string, name: string };
    userCount?: number;
}

export function ProfilesManager() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCloning, setIsCloning] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Editable state
    const [formData, setFormData] = useState<Partial<Profile>>({});
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Clone state
    const [cloneName, setCloneName] = useState("");
    const [cloneDesc, setCloneDesc] = useState("");

    const { toast } = useToast();

    const fetchProfiles = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/profiles`, {
                headers: withAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setProfiles(data);
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to load profiles.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const handleSelectProfile = (profile: Profile) => {
        if (hasUnsavedChanges && !confirm("You have unsaved changes. Discard them?")) {
            return;
        }
        // Debug: verify API data

        setSelectedProfile(profile);
        setIsEditing(false);
        setIsCloning(false);
        const merged = {
            ...profile,
            modulePermissions: mergeModulePermissions(profile.modulePermissions),
            setupPermissions: mergeSetupPermissions(profile.setupPermissions),
        };
        setFormData(merged);
        setHasUnsavedChanges(false);
    };

    const handleStartClone = (profile: Profile) => {
        setSelectedProfile(profile);
        setIsCloning(true);
        setIsEditing(false);
        setCloneName(`${profile.name} (Clone)`);
        setCloneDesc(`Cloned from ${profile.name}`);
    };

    const submitClone = async () => {
        const trimmedName = cloneName?.trim();
        if (!trimmedName || !selectedProfile) {
            if (!trimmedName) toast({ title: "Validation", description: "Please enter a profile name.", variant: "destructive" });
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/profiles/${selectedProfile._id}/clone`, {
                method: 'POST',
                headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ name: trimmedName, description: cloneDesc ?? "" })
            });

            if (!res.ok) throw new Error("Failed to clone profile");

            const newProfile = await res.json();
            toast({ title: "Success", description: "Profile cloned successfully." });
            await fetchProfiles();

            // Switch to edit mode on the new profile
            setIsCloning(false);
            handleSelectProfile(newProfile);
            setIsEditing(true);

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleSave = async () => {
        if (!selectedProfile || !formData.name) return;

        try {
            const res = await fetch(`${API_BASE_URL}/profiles/${selectedProfile._id}`, {
                method: 'PUT',
                headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description,
                    modulePermissions: formData.modulePermissions,
                    setupPermissions: formData.setupPermissions
                })
            });

            if (!res.ok) throw new Error("Failed to save profile");

            toast({ title: "Success", description: "Profile updated successfully." });
            setHasUnsavedChanges(false);
            await fetchProfiles();

            const updated = await res.json();
            setSelectedProfile(updated);
            setFormData({
                ...updated,
                modulePermissions: mergeModulePermissions(updated.modulePermissions),
                setupPermissions: mergeSetupPermissions(updated.setupPermissions),
            });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleDelete = async (profile: Profile) => {
        if (profile.isSystemProfile) {
            toast({ title: "Restricted", description: "System profiles cannot be deleted.", variant: "destructive" });
            return;
        }
        if (!confirm(`Are you sure you want to delete profile '${profile.name}'?`)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/profiles/${profile._id}`, {
                method: 'DELETE',
                headers: withAuthHeaders()
            });
            if (!res.ok) throw new Error(await res.text());

            toast({ title: "Success", description: "Profile deleted." });
            if (selectedProfile?._id === profile._id) setSelectedProfile(null);
            await fetchProfiles();
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" });
        }
    };

    const updateModulePermission = (moduleName: string, action: keyof Omit<ModulePermission, "module">, value: boolean) => {
        if (!formData.modulePermissions) return;
        const newPerms = [...formData.modulePermissions];
        const idx = newPerms.findIndex(p => p.module === moduleName);
        if (idx >= 0) {
            newPerms[idx] = { ...newPerms[idx], [action]: value };

            // If view is turned off, force create/edit/delete off
            if (action === "view" && value === false) {
                newPerms[idx].create = false;
                newPerms[idx].edit = false;
                newPerms[idx].delete = false;
            }

            setFormData({ ...formData, modulePermissions: newPerms });
            setHasUnsavedChanges(true);
        }
    };

    const updateSetupPermission = (key: string, enabled: boolean) => {
        if (!formData.setupPermissions) return;
        const newPerms = [...formData.setupPermissions];
        const idx = newPerms.findIndex(p => p.key === key);
        if (idx >= 0) {
            newPerms[idx] = { ...newPerms[idx], enabled };
            setFormData({ ...formData, setupPermissions: newPerms });
            setHasUnsavedChanges(true);
        }
    };

    const filteredProfiles = profiles.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (isLoading && profiles.length === 0) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    // MAIN LIST MENU
    if (!selectedProfile) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Profiles</h2>
                        <p className="text-muted-foreground">Manage feature access and module permissions for users.</p>
                    </div>
                </div>

                <Card className="border-border/50 shadow-sm">
                    <CardHeader className="p-4 border-b bg-muted/10 pb-3 flex flex-row items-center justify-between">
                        <div className="relative w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search profiles..."
                                className="pl-9 bg-background"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" onClick={() => alert("To create a new profile, please clone an existing one.")} className="gap-2">
                            <Copy className="h-4 w-4" /> Clone Profile
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {filteredProfiles.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">No profiles found.</div>
                            ) : (
                                filteredProfiles.map(p => (
                                    <div key={p._id} className="p-6 hover:bg-muted/30 transition-colors group flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2.5 bg-gray-100 rounded-lg text-gray-500">
                                                <ShieldCheck className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3
                                                        className="font-semibold text-lg cursor-pointer hover:text-primary transition-colors"
                                                        onClick={() => handleSelectProfile(p)}
                                                    >
                                                        {p.name}
                                                    </h3>
                                                    {p.isSystemProfile ? (
                                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">System</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full border border-blue-200">Custom</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground mb-2">{p.description || "No description."}</p>
                                                <div className="flex gap-4 text-xs text-gray-500">
                                                    <span>{p.userCount || 0} users</span>
                                                    {p.clonedFrom && <span>Cloned from: {p.clonedFrom.name}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="sm" onClick={() => handleStartClone(p)} className="h-8">Clone</Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleSelectProfile(p)} className="h-8">View</Button>
                                            {!p.isSystemProfile && (
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(p)} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">Delete</Button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // CLONE MODAL OVERLAY
    if (isCloning) {
        return (
            <div className="max-w-xl mx-auto mt-10">
                <Card>
                    <CardHeader>
                        <CardTitle>Clone Profile</CardTitle>
                        <CardDescription>Create a new profile based on the permissions of <strong>{selectedProfile.name}</strong>.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>New Profile Name</Label>
                            <Input value={cloneName} onChange={e => setCloneName(e.target.value)} autoFocus />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={cloneDesc} onChange={e => setCloneDesc(e.target.value)} />
                        </div>
                        <div className="pt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setIsCloning(false); setSelectedProfile(null); }}>Cancel</Button>
                            <Button onClick={submitClone}>Create Clone</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // PROFILE DETAILS AND EDITOR
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {hasUnsavedChanges && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">You have unsaved changes to this profile.</span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="bg-white" onClick={() => handleSelectProfile(selectedProfile)}>Discard</Button>
                        <Button size="sm" onClick={handleSave}>Save Changes</Button>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-end">
                <div className="flex gap-3 items-start">
                    <Button variant="ghost" size="icon" className="mt-1" onClick={() => {
                        if (hasUnsavedChanges && !confirm("Discard unsaved changes?")) return;
                        setSelectedProfile(null);
                        setHasUnsavedChanges(false);
                    }}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            {isEditing && !selectedProfile.isSystemProfile ? (
                                <Input
                                    value={formData.name || ""}
                                    onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setHasUnsavedChanges(true); }}
                                    className="font-bold text-2xl h-10 w-64"
                                />
                            ) : (
                                <h1 className="text-3xl font-bold tracking-tight">{selectedProfile.name}</h1>
                            )}
                            {selectedProfile.isSystemProfile && <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">System Profile</Badge>}
                        </div>

                        {isEditing && !selectedProfile.isSystemProfile ? (
                            <Input
                                value={formData.description || ""}
                                onChange={(e) => { setFormData({ ...formData, description: e.target.value }); setHasUnsavedChanges(true); }}
                                className="text-muted-foreground mt-2 w-96 max-w-full"
                                placeholder="Profile description"
                            />
                        ) : (
                            <p className="text-muted-foreground mt-1">{selectedProfile.description}</p>
                        )}
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleStartClone(selectedProfile)} className="gap-2">
                        <Copy className="h-4 w-4" /> Clone
                    </Button>
                    {!selectedProfile.isSystemProfile && !isEditing && (
                        <Button onClick={() => setIsEditing(true)}>Edit Permissions</Button>
                    )}
                    {isEditing && (
                        <Button onClick={handleSave} disabled={!hasUnsavedChanges} className="gap-2">
                            <Save className="h-4 w-4" /> Save
                        </Button>
                    )}
                </div>
            </div>

            <Card className="border-border/50 shadow-sm mt-4">
                <Tabs defaultValue="modules">
                    <div className="px-6 pt-4 border-b">
                        <TabsList className="bg-transparent border-b-0 space-x-6 p-0 h-auto">
                            <TabsTrigger
                                value="modules"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 py-3 text-base font-medium"
                            >
                                Module Permissions
                            </TabsTrigger>
                            <TabsTrigger
                                value="setup"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 py-3 text-base font-medium"
                            >
                                Setup Permissions
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="modules" className="p-0 m-0">
                        <div className="p-6">
                            <h3 className="text-lg font-medium mb-4">Basic Permissions</h3>
                            <p className="text-sm text-muted-foreground mb-6">Control which modules users can view and the actions they can perform on records within those modules.</p>

                            <PermissionsTable
                                permissions={formData.modulePermissions || []}
                                isEditable={isEditing && !selectedProfile.isSystemProfile}
                                onPermissionChange={updateModulePermission}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="setup" className="p-0 m-0">
                        <div className="p-6">
                            <h3 className="text-lg font-medium mb-4">Admin & Setup Permissions</h3>
                            <p className="text-sm text-muted-foreground mb-6">Control access to system configuration and administration features.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 max-w-4xl">
                                {(formData.setupPermissions || []).map(perm => (
                                    <div key={perm.key} className="flex items-center justify-between py-3 border-b">
                                        <div>
                                            <p className="font-medium text-gray-900">{perm.key.split('.').join(' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                                            <p className="text-xs text-muted-foreground">Internal Key: {perm.key}</p>
                                        </div>
                                        <Switch
                                            checked={perm.enabled}
                                            disabled={!isEditing || selectedProfile.isSystemProfile}
                                            onCheckedChange={(c) => updateSetupPermission(perm.key, c)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </Card>
        </div>
    );
}

// Helper stub for Badge since it wasn't explicitly imported
function Badge({ children, variant, className }: any) {
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>{children}</span>;
}
