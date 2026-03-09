import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    CustomFieldsService,
    CustomFieldDefinition,
    CustomFieldPayload,
    CustomFieldModule,
} from "@/services/customFields";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, GripVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const MODULES: { id: CustomFieldModule; label: string }[] = [
    { id: "leads", label: "Leads" },
    { id: "contacts", label: "Contacts" },
    { id: "accounts", label: "Accounts" },
];

const DATA_TYPES = [
    { id: "TEXT", label: "Single Line Text" },
    { id: "TEXTAREA", label: "Multi Line Text" },
    { id: "NUMBER", label: "Number" },
    { id: "DATE", label: "Date" },
    { id: "DROPDOWN", label: "Dropdown (Picklist)" },
    { id: "BOOLEAN", label: "Checkbox (Boolean)" },
];

export function ModuleBuilder() {
    const [activeModule, setActiveModule] = useState<CustomFieldModule>("leads");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);

    // Form State
    const [fieldName, setFieldName] = useState("");
    const [label, setLabel] = useState("");
    const [dataType, setDataType] = useState("TEXT");
    const [isRequired, setIsRequired] = useState(false);
    const [optionsStr, setOptionsStr] = useState(""); // Comma separated for dropdowns

    const queryClient = useQueryClient();

    const { data: fields, isLoading } = useQuery({
        queryKey: ["custom-fields", "admin", activeModule],
        queryFn: () => CustomFieldsService.getAllFieldsForModuleParams(activeModule),
    });

    const createMutation = useMutation({
        mutationFn: CustomFieldsService.createField,
        onSuccess: () => {
            toast.success("Field created successfully");
            queryClient.invalidateQueries({ queryKey: ["custom-fields", "admin", activeModule] });
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to create field");
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: Partial<CustomFieldPayload> }) =>
            CustomFieldsService.updateField(id, payload),
        onSuccess: () => {
            toast.success("Field updated successfully");
            queryClient.invalidateQueries({ queryKey: ["custom-fields", "admin", activeModule] });
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to update field");
        },
    });

    const deactivateMutation = useMutation({
        mutationFn: CustomFieldsService.deactivateField,
        onSuccess: () => {
            toast.success("Field deactivated");
            queryClient.invalidateQueries({ queryKey: ["custom-fields", "admin", activeModule] });
        },
    });

    const resetForm = () => {
        setEditingField(null);
        setFieldName("");
        setLabel("");
        setDataType("TEXT");
        setIsRequired(false);
        setOptionsStr("");
    };

    const openNewDialog = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const openEditDialog = (field: CustomFieldDefinition) => {
        setEditingField(field);
        setFieldName(field.fieldName);
        setLabel(field.label);
        setDataType(field.dataType);
        setIsRequired(field.isRequired);
        if (field.dataType === "DROPDOWN" && field.options) {
            setOptionsStr(field.options.map(o => o.value).join(", "));
        } else {
            setOptionsStr("");
        }
        setIsDialogOpen(true);
    };

    const handleSave = () => {
        if (!fieldName || !label) {
            toast.error("Field Key and Label are required");
            return;
        }

        const payload: CustomFieldPayload = {
            module: activeModule,
            fieldName,
            label,
            dataType: dataType as any,
            isRequired,
            isActive: true, // Auto active on save
        };

        if (dataType === "DROPDOWN") {
            const opts = optionsStr.split(",").map(s => s.trim()).filter(Boolean);
            if (opts.length === 0) {
                toast.error("Dropdown requires at least one option");
                return;
            }
            payload.options = opts.map(o => ({ label: o, value: o }));
        }

        if (editingField) {
            updateMutation.mutate({ id: editingField._id, payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleToggleActive = (field: CustomFieldDefinition) => {
        updateMutation.mutate({
            id: field._id,
            payload: { isActive: !field.isActive }
        });
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Module Builder</h1>
                    <p className="text-muted-foreground mt-2">
                        Customize fields and forms for different CRM modules.
                    </p>
                </div>
                <Button onClick={openNewDialog} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Add Field
                </Button>
            </div>

            <Tabs defaultValue="leads" onValueChange={(v) => setActiveModule(v as CustomFieldModule)}>
                <TabsList className="grid w-full grid-cols-3 max-w-md">
                    {MODULES.map(m => (
                        <TabsTrigger key={m.id} value={m.id}>{m.label}</TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            <Card>
                <CardHeader>
                    <CardTitle>Fields for {MODULES.find(m => m.id === activeModule)?.label}</CardTitle>
                    <CardDescription>Drag and drop is coming soon. Active fields appear on standard forms.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                    ) : (fields && fields.length > 0) ? (
                        <div className="space-y-3">
                            {fields.map((field) => (
                                <div key={field._id} className={`flex items-center justify-between p-4 border rounded-lg ${!field.isActive ? 'opacity-60 bg-muted/50' : 'bg-card'}`}>
                                    <div className="flex items-center gap-4">
                                        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold">{field.label}</p>
                                                {field.isRequired && <span className="text-xs text-red-500 font-bold">*</span>}
                                                <span className="text-xs tracking-wider bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full uppercase">
                                                    {field.dataType}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground font-mono mt-1">{field.fieldName}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center space-x-2">
                                            <Label htmlFor={`active-${field._id}`} className="text-sm text-muted-foreground">
                                                {field.isActive ? 'Active' : 'Hidden'}
                                            </Label>
                                            <Switch
                                                id={`active-${field._id}`}
                                                checked={field.isActive}
                                                onCheckedChange={() => handleToggleActive(field)}
                                            />
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(field)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-8 text-muted-foreground">
                            No custom fields found for this module.
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingField ? "Edit Field" : "Create New Field"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Label</Label>
                            <Input className="col-span-3" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Current CRM" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">API Key</Label>
                            <Input className="col-span-3 font-mono" value={fieldName} onChange={e => setFieldName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} placeholder="e.g. current_crm" disabled={!!editingField} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Type</Label>
                            <Select value={dataType} onValueChange={setDataType} disabled={!!editingField}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DATA_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {dataType === "DROPDOWN" && (
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right mt-2">Options</Label>
                                <div className="col-span-3 space-y-1">
                                    <Input value={optionsStr} onChange={e => setOptionsStr(e.target.value)} placeholder="Yes, No, Maybe" />
                                    <p className="text-xs text-muted-foreground">Comma separated values</p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Required</Label>
                            <div className="col-span-3 flex items-center space-x-2">
                                <Switch checked={isRequired} onCheckedChange={setIsRequired} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                            {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default ModuleBuilder;
