import { useState, useEffect } from "react";
import { Plus, ShieldAlert, Loader2, Save, Trash2, Info, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";

interface ModuleDefaultAccess {
    module: string;
    defaultAccess: 'private' | 'public_read' | 'public_read_write' | 'public_full';
}

interface DataSharingRule {
    _id: string;
    module: string;
    fromType: 'role' | 'group';
    fromId: { _id: string, name: string };
    toType: 'role' | 'group';
    toId: { _id: string, name: string };
    accessLevel: 'read' | 'read_write' | 'full';
    isActive: boolean;
}

export function DataSharingManager() {
    const [defaults, setDefaults] = useState<ModuleDefaultAccess[]>([]);
    const [selectedDefaults, setSelectedDefaults] = useState<Record<string, string>>({}); // For unsaved edits
    const [hasUnsavedDefaults, setHasUnsavedDefaults] = useState(false);

    const [rules, setRules] = useState<DataSharingRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal State
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [allRoles, setAllRoles] = useState<{ _id: string, name: string }[]>([]);
    const [allGroups, setAllGroups] = useState<{ _id: string, name: string }[]>([]);

    const [newRule, setNewRule] = useState<Partial<DataSharingRule>>({
        module: 'leads',
        fromType: 'role',
        toType: 'role',
        accessLevel: 'read',
        isActive: true
    });

    const { toast } = useToast();

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [defRes, ruleRes, rolesRes, groupsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/data-sharing/defaults`, { headers: withAuthHeaders() }),
                fetch(`${API_BASE_URL}/data-sharing/rules`, { headers: withAuthHeaders() }),
                fetch(`${API_BASE_URL}/roles`, { headers: withAuthHeaders() }),
                fetch(`${API_BASE_URL}/groups`, { headers: withAuthHeaders() })
            ]);

            if (defRes.ok) {
                const data = await defRes.json();
                setDefaults(data);

                // Intialize local edit state
                const editState: Record<string, string> = {};
                data.forEach((d: any) => editState[d.module] = d.defaultAccess);
                setSelectedDefaults(editState);
                setHasUnsavedDefaults(false);
            }

            if (ruleRes.ok) setRules(await ruleRes.json());
            if (rolesRes.ok) setAllRoles(await rolesRes.json());
            if (groupsRes.ok) setAllGroups(await groupsRes.json());

        } catch (error) {
            toast({ title: "Error", description: "Failed to load data sharing settings.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDefaultChange = (module: string, value: string) => {
        setSelectedDefaults(prev => ({ ...prev, [module]: value }));
        setHasUnsavedDefaults(true);
    };

    const saveDefaults = async () => {
        try {
            const promises = Object.keys(selectedDefaults).map(module =>
                fetch(`${API_BASE_URL}/data-sharing/defaults`, {
                    method: 'PUT',
                    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ module, defaultAccess: selectedDefaults[module] })
                })
            );

            await Promise.all(promises);
            toast({ title: "Success", description: "Default sharing settings saved." });
            setHasUnsavedDefaults(false);
            fetchData();
        } catch (error) {
            toast({ title: "Error", description: "Failed to save default settings.", variant: "destructive" });
        }
    };

    const handleCreateRule = async () => {
        if (!newRule.fromId || !newRule.toId) {
            toast({ title: "Validation Error", description: "Please select both Source and Target.", variant: "destructive" });
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/data-sharing/rules`, {
                method: 'POST',
                headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
                // Exclude names and just pass ID string payload
                body: JSON.stringify({
                    module: newRule.module,
                    fromType: newRule.fromType,
                    fromId: (newRule.fromId as any),
                    toType: newRule.toType,
                    toId: (newRule.toId as any),
                    accessLevel: newRule.accessLevel,
                    isActive: true
                })
            });

            if (!res.ok) throw new Error(await res.text());

            toast({ title: "Success", description: "Sharing rule created." });
            setIsRuleModalOpen(false);
            fetchData();
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to create rule", variant: "destructive" });
        }
    };

    const handleDeleteRule = async (id: string) => {
        if (!confirm("Delete this sharing rule? Access provided by this rule will be immediately revoked.")) return;
        try {
            const res = await fetch(`${API_BASE_URL}/data-sharing/rules/${id}`, {
                method: 'DELETE',
                headers: withAuthHeaders()
            });
            if (!res.ok) throw new Error("Failed to delete rule");
            toast({ title: "Success", description: "Sharing rule deleted." });
            fetchData();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const getLabel = (level: string) => {
        switch (level) {
            case 'private': return 'Private';
            case 'public_read': return 'Public - Read Only';
            case 'public_read_write': return 'Public - Read/Write';
            case 'public_full': return 'Public - Full Access';
            case 'read': return 'Read Only';
            case 'read_write': return 'Read/Write';
            case 'full': return 'Full Access';
            default: return level;
        }
    };

    const getModuleDisplayName = (moduleName: string) => {
        return moduleName.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    };

    if (isLoading && defaults.length === 0) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    const modules = Object.keys(selectedDefaults); // Unique module list

    return (
        <div className="space-y-8 pb-12">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Data Sharing Settings</h2>
                    <p className="text-muted-foreground">Control data visibility across roles, groups, and the entire organization.</p>
                </div>
            </div>

            {/* SECTION 1: Default Access */}
            <Card className="border-border/50 shadow-sm relative">
                <CardHeader className="border-b bg-muted/5 p-6">
                    <CardTitle className="text-xl">1. Default Organization Access</CardTitle>
                    <CardDescription className="max-w-3xl mt-2 text-sm">
                        Set the baseline visibility for each module.
                        <strong> "Private"</strong> means users can only see records they own or are owned by users under them in the Role hierarchy.
                        <strong> "Public"</strong> options override the hierarchy and grant access to everyone in the organization.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-2 bg-muted/30 border-b font-medium text-sm text-gray-700 py-3 px-6">
                        <div>Module</div>
                        <div>Default Access Level</div>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {modules.map((mod, idx) => (
                            <div key={mod} className={`grid grid-cols-2 py-3 items-center px-6 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                                <div className="font-medium text-gray-900">{getModuleDisplayName(mod)}</div>
                                <div className="flex items-center gap-4">
                                    <select
                                        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary w-64"
                                        value={selectedDefaults[mod]}
                                        onChange={(e) => handleDefaultChange(mod, e.target.value)}
                                    >
                                        <option value="private">Private</option>
                                        <option value="public_read">Public - Read Only</option>
                                        <option value="public_read_write">Public - Read/Write</option>
                                        <option value="public_full">Public - Full Access (Delete)</option>
                                    </select>
                                    {selectedDefaults[mod] === 'private' && (
                                        <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                                            <ShieldAlert className="w-3.5 h-3.5" /> Checked Hierarchy
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 bg-gray-50 border-t flex justify-end">
                        <Button onClick={saveDefaults} disabled={!hasUnsavedDefaults} className="gap-2">
                            {hasUnsavedDefaults && <div className="w-2 h-2 rounded-full bg-yellow-300 mr-1 animate-pulse" />}
                            <Save className="h-4 w-4" /> Save Default Settings
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* SECTION 2: Sharing Rules */}
            <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b bg-muted/5 p-6 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-xl">2. Sharing Rules</CardTitle>
                        <CardDescription className="max-w-3xl mt-2 text-sm">
                            Create rules to share data <em>laterally</em> or <em>upwards</em>. For example, share Leads owned by the "Sales" role with the "Marketing" role.
                            <strong> Rules only apply to modules set to "Private" default access.</strong>
                        </CardDescription>
                    </div>
                    <Button onClick={() => {
                        setNewRule({ module: modules[0] || 'leads', fromType: 'role', toType: 'role', accessLevel: 'read', isActive: true });
                        setIsRuleModalOpen(true);
                    }}
                        className="gap-2 shrink-0 h-10"
                    >
                        <Plus className="h-4 w-4" /> New Sharing Rule
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    {rules.length === 0 ? (
                        <div className="p-12 text-center flex justify-center flex-col items-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                <Info className="w-6 h-6" />
                            </div>
                            <p className="text-muted-foreground font-medium mb-1">No Sharing Rules Configured</p>
                            <p className="text-sm text-gray-400 max-w-sm">Create rules to extend access beyond the standard role hierarchy.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-12 bg-muted/30 border-b font-medium text-xs text-gray-500 uppercase tracking-wider py-3 px-6">
                                <div className="col-span-2">Module</div>
                                <div className="col-span-3">Data from (Source)</div>
                                <div className="col-span-1 text-center"></div>
                                <div className="col-span-3">Shared to (Target)</div>
                                <div className="col-span-2">Access Type</div>
                                <div className="col-span-1 text-right">Actions</div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {rules.map((rule) => (
                                    <div key={rule._id} className="grid grid-cols-12 py-4 items-center px-6 hover:bg-gray-50 transition-colors group">
                                        <div className="col-span-2 font-medium text-gray-900">{getModuleDisplayName(rule.module)}</div>

                                        <div className="col-span-3 flex flex-col">
                                            <span className="text-xs text-gray-500 uppercase font-semibold">{rule.fromType}</span>
                                            <span className="text-sm font-medium">{rule.fromId?.name || "Unknown"}</span>
                                        </div>

                                        <div className="col-span-1 flex justify-center text-gray-300">
                                            <ArrowRight className="h-5 w-5" />
                                        </div>

                                        <div className="col-span-3 flex flex-col">
                                            <span className="text-xs text-gray-500 uppercase font-semibold">{rule.toType}</span>
                                            <span className="text-sm font-medium">{rule.toId?.name || "Unknown"}</span>
                                        </div>

                                        <div className="col-span-2 flex items-center">
                                            <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded border">
                                                {getLabel(rule.accessLevel)}
                                            </span>
                                        </div>

                                        <div className="col-span-1 text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule._id)} className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ADD RULE DIALOG */}
            <Dialog open={isRuleModalOpen} onOpenChange={setIsRuleModalOpen}>
                <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                        <DialogTitle>Add Data Sharing Rule</DialogTitle>
                        <DialogDescription>
                            Records owned by the source will be appended to the visibility scope of the target.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="grid gap-2">
                            <Label>Module</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={newRule.module}
                                onChange={e => setNewRule({ ...newRule, module: e.target.value })}
                            >
                                {modules.map(m => <option key={m} value={m}>{getModuleDisplayName(m)}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="border rounded-lg p-4 bg-gray-50/50 space-y-4">
                                <h4 className="text-sm font-semibold flex items-center gap-2">Data From <span className="text-muted-foreground font-normal">(Records owned by)</span></h4>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Type</Label>
                                    <select
                                        className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={newRule.fromType}
                                        onChange={e => setNewRule({ ...newRule, fromType: e.target.value as 'role' | 'group', fromId: undefined })} // Reset ID on type change
                                    >
                                        <option value="role">Role (and Subordinates)</option>
                                        <option value="group">Group</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">{newRule.fromType === 'role' ? 'Select Role' : 'Select Group'}</Label>
                                    <select
                                        className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={(newRule.fromId as any) || ""}
                                        onChange={e => setNewRule({ ...newRule, fromId: e.target.value as any })}
                                    >
                                        <option value="">-- Select --</option>
                                        {(newRule.fromType === 'role' ? allRoles : allGroups).map(i => (
                                            <option key={i._id} value={i._id}>{i.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="border rounded-lg p-4 bg-blue-50/30 space-y-4">
                                <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">Shared To <span className="text-muted-foreground font-normal">(Granted access)</span></h4>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Type</Label>
                                    <select
                                        className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={newRule.toType}
                                        onChange={e => setNewRule({ ...newRule, toType: e.target.value as 'role' | 'group', toId: undefined })} // Reset ID on type change
                                    >
                                        <option value="role">Role (and Subordinates)</option>
                                        <option value="group">Group</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">{newRule.toType === 'role' ? 'Select Role' : 'Select Group'}</Label>
                                    <select
                                        className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={(newRule.toId as any) || ""}
                                        onChange={e => setNewRule({ ...newRule, toId: e.target.value as any })}
                                    >
                                        <option value="">-- Select --</option>
                                        {(newRule.toType === 'role' ? allRoles : allGroups).map(i => (
                                            <option key={i._id} value={i._id}>{i.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-2 border-t pt-4">
                            <Label>Type of Access Granted</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={newRule.accessLevel}
                                onChange={e => setNewRule({ ...newRule, accessLevel: e.target.value as any })}
                            >
                                <option value="read">Read Only</option>
                                <option value="read_write">Read/Write</option>
                                <option value="full">Full Access (Read/Write/Delete)</option>
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRuleModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateRule}>Create Rule</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
