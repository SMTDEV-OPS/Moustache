import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Save, X } from "lucide-react";
import {
    ORGANIZATION_TYPES,
    ACCOUNT_LEVELS,
    INDUSTRY_CATEGORIES,
    INDIAN_STATES,
    MAJOR_INDIAN_CITIES,
    MONTHS
} from "@/constants/accountData";
import { listConglomerates, Conglomerate } from "@/services/conglomerates";
import { Account, createAccount, updateAccount, listAccounts } from "@/services/accounts";
import { listProperties, Property } from "@/services/properties";
import { cn } from "@/lib/utils";

interface AccountCreationWizardProps {
    isOpen: boolean;
    onClose: () => void;
    editingAccount?: Account | null;
    onSuccess: () => void;
}

const emptyForm = {
    name: "",
    organizationType: "CORPORATE",
    customOrganizationType: "",
    conglomerateId: null as string | null,
    accountLevel: "MASTER",
    profileStatus: false,
    accountType: "ACQUISITION",
    accountTypeOverride: false,
    parentAccountId: null as string | null,
    propertyIds: [] as string[],
    zone: "",
    city: "",
    state: "",
    locality: "",
    country: "India",
    addressLine1: "",
    zip: "",
    gstin: "",
    panNumber: "",
    pmsProfileId: "",
    email: "",
    website: "",
    industryCategory: "",
    industrySubCategory: "",
    industrySize: "MEDIUM",
    contractingTypes: [] as any[],
    primaryAccountManager: { userId: "", name: "", city: "" },
    secondaryAccountManagers: [] as any[],
};

export const AccountCreationWizard = ({ isOpen, onClose, editingAccount, onSuccess }: AccountCreationWizardProps) => {
    const { toast } = useToast();
    const [conglomerates, setConglomerates] = useState<Conglomerate[]>([]);
    const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);
    const [properties, setProperties] = useState<Property[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<typeof emptyForm>({ ...emptyForm });

    const set = (patch: Partial<typeof emptyForm>) => setFormData(prev => ({ ...prev, ...patch }));

    useEffect(() => {
        if (editingAccount) {
            setFormData({
                ...emptyForm,
                ...(editingAccount as any),
                conglomerateId: (editingAccount as any).conglomerateId || null,
                parentAccountId: (editingAccount as any).parentAccountId || null,
                primaryAccountManager: (editingAccount as any).primaryAccountManager || { userId: "", name: "", city: "" },
                secondaryAccountManagers: (editingAccount as any).secondaryAccountManagers || [],
            });
        } else {
            setFormData({ ...emptyForm });
        }
    }, [editingAccount, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        Promise.all([listConglomerates(), listAccounts(), listProperties()])
            .then(([congs, accs, props]) => {
                setConglomerates(congs);
                setAvailableAccounts(accs);
                setProperties(props);
            })
            .catch(err => console.error("Failed to fetch reference data:", err));
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            toast({ title: "Validation Error", description: "Account name is required", variant: "destructive" });
            return;
        }

        try {
            setIsSubmitting(true);
            const sanitized: any = { ...formData };

            // Map org type to legacy type field
            if (!sanitized.type) {
                const legacyMap: Record<string, string> = {
                    CORPORATE: "CORPORATE", TRAVEL_AGENT: "TRAVEL_AGENT",
                    EVENT_PLANNER: "EVENT_PLANNER", PCO: "EVENT_PLANNER",
                    AIRLINE: "AIRLINES", GOVERNMENT: "GOVERNMENT",
                    EMBASSY_CONSULATE: "GOVERNMENT", PSU: "GOVERNMENT", CUSTOM: "OTHER",
                };
                sanitized.type = legacyMap[sanitized.organizationType] || "OTHER";
            }

            // Clean up null/empty ref IDs
            if (!sanitized.conglomerateId) delete sanitized.conglomerateId;
            if (!sanitized.parentAccountId) delete sanitized.parentAccountId;

            // Clean up account managers
            if (sanitized.primaryAccountManager) {
                const pam = sanitized.primaryAccountManager;
                if (!pam.name && !pam.userId) {
                    delete sanitized.primaryAccountManager;
                } else if (pam.userId === "") {
                    sanitized.primaryAccountManager = { name: pam.name, city: pam.city };
                }
            }
            if (sanitized.secondaryAccountManagers?.length) {
                sanitized.secondaryAccountManagers = sanitized.secondaryAccountManagers
                    .filter((m: any) => m.name?.trim() || m.userId?.trim())
                    .map((m: any) => {
                        const s = { ...m };
                        if (s.userId === "") delete s.userId;
                        return s;
                    });
            }

            // Strip empty strings for optional fields
            for (const key of Object.keys(sanitized)) {
                if (sanitized[key] === "") delete sanitized[key];
            }

            if (editingAccount) {
                await updateAccount(editingAccount.id, sanitized);
            } else {
                await createAccount(sanitized);
            }

            toast({ title: "Success", description: editingAccount ? "Account updated" : "Account created" });
            onSuccess();
            onClose();
        } catch (err) {
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Failed to save account",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const addSam = () =>
        set({ secondaryAccountManagers: [...formData.secondaryAccountManagers, { userId: "", name: "", city: "" }] });

    const removeSam = (i: number) =>
        set({ secondaryAccountManagers: formData.secondaryAccountManagers.filter((_, idx) => idx !== i) });

    const updateSam = (i: number, patch: any) =>
        set({
            secondaryAccountManagers: formData.secondaryAccountManagers.map((m, idx) =>
                idx === i ? { ...m, ...patch } : m
            ),
        });

    const toggleContractingType = (type: string, checked: boolean) => {
        let types = [...formData.contractingTypes];
        if (checked) {
            types.push({ type, fromMonth: 4, toMonth: 3 });
        } else {
            types = types.filter((t: any) => t.type !== type);
        }
        set({ contractingTypes: types });
    };

    const updateContractingType = (type: string, patch: any) =>
        set({
            contractingTypes: formData.contractingTypes.map((t: any) =>
                t.type === type ? { ...t, ...patch } : t
            ),
        });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-5 pb-4 border-b">
                    <DialogTitle className="text-base font-semibold">
                        {editingAccount ? "Edit Account" : "New Account"}
                    </DialogTitle>
                </DialogHeader>

                {/* Scrollable form body */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

                    {/* Basic Information */}
                    <section className="space-y-3">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Basic Information</h4>
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="name">Account Name <span className="text-destructive">*</span></Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={e => set({ name: e.target.value })}
                                    placeholder="Legal entity name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Organization Type</Label>
                                    <Select value={formData.organizationType} onValueChange={v => set({ organizationType: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {ORGANIZATION_TYPES.map(t => (
                                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {formData.organizationType === "CUSTOM" && (
                                    <div className="space-y-1.5">
                                        <Label>Custom Type</Label>
                                        <Input
                                            value={formData.customOrganizationType}
                                            onChange={e => set({ customOrganizationType: e.target.value })}
                                            placeholder="Specify type"
                                        />
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <Label>Account Level</Label>
                                    <Select value={formData.accountLevel} onValueChange={v => set({ accountLevel: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {ACCOUNT_LEVELS.map(l => (
                                                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Email</Label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => set({ email: e.target.value })}
                                        placeholder="contact@company.com"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Website</Label>
                                    <Input
                                        value={formData.website}
                                        onChange={e => set({ website: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-border" />

                    {/* Classification */}
                    <section className="space-y-3">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Classification</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Account Type</Label>
                                <Select value={formData.accountType} onValueChange={v => set({ accountType: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {["ACQUISITION", "DEVELOPMENT", "RETENTION"].map(t => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Account Type Override</Label>
                                <div className="flex items-center gap-2 pt-2">
                                    <Checkbox
                                        id="accountTypeOverride"
                                        checked={formData.accountTypeOverride}
                                        onCheckedChange={v => set({ accountTypeOverride: !!v })}
                                    />
                                    <label htmlFor="accountTypeOverride" className="text-sm cursor-pointer">
                                        Manual override enabled
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <Checkbox
                                id="isHq"
                                checked={formData.profileStatus}
                                onCheckedChange={v => set({ profileStatus: !!v })}
                            />
                            <label htmlFor="isHq" className="text-sm cursor-pointer">This account is a Headquarter</label>
                        </div>
                    </section>

                    <hr className="border-border" />

                    {/* Hierarchy */}
                    <section className="space-y-3">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hierarchy</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Conglomerate</Label>
                                <Select
                                    value={formData.conglomerateId || "none"}
                                    onValueChange={v => set({ conglomerateId: v === "none" ? null : v })}
                                >
                                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None / Individual</SelectItem>
                                        {conglomerates.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.country})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Parent Account</Label>
                                <Select
                                    value={formData.parentAccountId || "none"}
                                    onValueChange={v => set({ parentAccountId: v === "none" ? null : v })}
                                >
                                    <SelectTrigger><SelectValue placeholder="Root level" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Root level (no parent)</SelectItem>
                                        {availableAccounts
                                            .filter(a => a.id !== editingAccount?.id)
                                            .map(a => (
                                                <SelectItem key={a.id} value={a.id}>
                                                    {a.name}{a.city ? ` · ${a.city}` : ""}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </section>

                    <hr className="border-border" />

                    {/* Property Mapping */}
                    <section className="space-y-3">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assign Properties</h4>
                        <div className="rounded-md border p-3 space-y-2 max-h-56 overflow-y-auto">
                            {properties.length === 0 && (
                                <p className="text-sm text-muted-foreground">No properties found</p>
                            )}
                            {properties.map((property) => {
                                const checked = formData.propertyIds.includes(property._id);
                                return (
                                    <label key={property._id} className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={(value) => {
                                                const next = value
                                                    ? [...formData.propertyIds, property._id]
                                                    : formData.propertyIds.filter((id) => id !== property._id);
                                                set({ propertyIds: next });
                                            }}
                                        />
                                        <span>{property.name}</span>
                                        {property.location?.city && (
                                            <span className="text-xs text-muted-foreground">({property.location.city})</span>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    </section>

                    <hr className="border-border" />

                    {/* Location */}
                    <section className="space-y-3">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</h4>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label>City</Label>
                                <Select value={formData.city || "none"} onValueChange={v => set({ city: v === "none" ? "" : v })}>
                                    <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">— Select city —</SelectItem>
                                        {MAJOR_INDIAN_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>State</Label>
                                <Select value={formData.state || "none"} onValueChange={v => set({ state: v === "none" ? "" : v })}>
                                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">— Select state —</SelectItem>
                                        {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Zone</Label>
                                <Select value={formData.zone || "none"} onValueChange={v => set({ zone: v === "none" ? "" : v })}>
                                    <SelectTrigger><SelectValue placeholder="Zone" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">— Select zone —</SelectItem>
                                        {["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"].map(z => (
                                            <SelectItem key={z} value={z}>{z}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Locality / Area</Label>
                                <Input
                                    value={formData.locality}
                                    onChange={e => set({ locality: e.target.value })}
                                    placeholder="e.g. Bandra Kurla Complex"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Country</Label>
                                <Select value={formData.country} onValueChange={v => set({ country: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="India">India</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Address</Label>
                                <Input
                                    value={formData.addressLine1}
                                    onChange={e => set({ addressLine1: e.target.value })}
                                    placeholder="Street / Building"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>PIN Code</Label>
                                <Input
                                    value={formData.zip}
                                    onChange={e => set({ zip: e.target.value })}
                                    placeholder="6-digit PIN"
                                />
                            </div>
                        </div>
                    </section>

                    <hr className="border-border" />

                    {/* Identification */}
                    <section className="space-y-3">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Identification</h4>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label>GSTIN</Label>
                                <Input
                                    value={formData.gstin}
                                    onChange={e => set({ gstin: e.target.value })}
                                    placeholder="15-digit GSTIN"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>PAN Number</Label>
                                <Input
                                    value={formData.panNumber}
                                    onChange={e => set({ panNumber: e.target.value })}
                                    placeholder="10-digit PAN"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>PMS Profile ID</Label>
                                <Input
                                    value={formData.pmsProfileId}
                                    onChange={e => set({ pmsProfileId: e.target.value })}
                                    placeholder="External system ID"
                                />
                            </div>
                        </div>
                    </section>

                    <hr className="border-border" />

                    {/* Sales Team */}
                    <section className="space-y-3">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sales Team Assignment</h4>
                        <div className="space-y-2">
                            <Label className="text-sm">Primary Account Manager (PAM)</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    placeholder="Manager name"
                                    value={formData.primaryAccountManager?.name || ""}
                                    onChange={e => set({ primaryAccountManager: { ...formData.primaryAccountManager, name: e.target.value } })}
                                />
                                <Input
                                    placeholder="Manager city"
                                    value={formData.primaryAccountManager?.city || ""}
                                    onChange={e => set({ primaryAccountManager: { ...formData.primaryAccountManager, city: e.target.value } })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm">Secondary Account Managers (SAM)</Label>
                                <Button type="button" variant="outline" size="sm" onClick={addSam}>
                                    + Add SAM
                                </Button>
                            </div>
                            {formData.secondaryAccountManagers.map((sam, i) => (
                                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                                    <Input
                                        placeholder="Name"
                                        value={sam.name}
                                        onChange={e => updateSam(i, { name: e.target.value })}
                                    />
                                    <Input
                                        placeholder="City"
                                        value={sam.city}
                                        onChange={e => updateSam(i, { city: e.target.value })}
                                    />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSam(i)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <hr className="border-border" />

                    {/* Industry */}
                    <section className="space-y-3">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Industry</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Category</Label>
                                <Select
                                    value={formData.industryCategory || "none"}
                                    onValueChange={v => set({ industryCategory: v === "none" ? "" : v, industrySubCategory: "" })}
                                >
                                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">— Select category —</SelectItem>
                                        {Object.keys(INDUSTRY_CATEGORIES).map(cat => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Sub-Category</Label>
                                <Select
                                    value={formData.industrySubCategory || "none"}
                                    onValueChange={v => set({ industrySubCategory: v === "none" ? "" : v })}
                                    disabled={!formData.industryCategory}
                                >
                                    <SelectTrigger><SelectValue placeholder="Select sub-category" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">— Select sub-category —</SelectItem>
                                        {formData.industryCategory && (INDUSTRY_CATEGORIES as any)[formData.industryCategory]?.map((sub: string) => (
                                            <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Industry Size</Label>
                            <Select value={formData.industrySize} onValueChange={v => set({ industrySize: v })}>
                                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SMALL">Small</SelectItem>
                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                    <SelectItem value="LARGE">Large</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </section>

                    <hr className="border-border" />

                    {/* Contracting Types */}
                    <section className="space-y-3">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contracting</h4>
                        <div className="space-y-3">
                            {["LOCAL_CONTRACTING", "LOCAL_RFP", "GLOBAL_RFP", "ANNUAL_CONTRACT"].map(type => {
                                const isChecked = formData.contractingTypes.some((t: any) => t.type === type);
                                const entry = formData.contractingTypes.find((t: any) => t.type === type);
                                return (
                                    <div key={type} className={cn("border rounded-md p-3 space-y-2", isChecked && "border-foreground/20 bg-muted/30")}>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id={`ct-${type}`}
                                                checked={isChecked}
                                                onCheckedChange={v => toggleContractingType(type, !!v)}
                                            />
                                            <label htmlFor={`ct-${type}`} className="text-sm font-medium cursor-pointer">
                                                {type.replace(/_/g, " ")}
                                            </label>
                                        </div>
                                        {isChecked && entry && (
                                            <div className="grid grid-cols-2 gap-3 pl-6">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">From Month</Label>
                                                    <Select
                                                        value={entry.fromMonth?.toString()}
                                                        onValueChange={v => updateContractingType(type, { fromMonth: parseInt(v) })}
                                                    >
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {MONTHS.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">To Month</Label>
                                                    <Select
                                                        value={entry.toMonth?.toString()}
                                                        onValueChange={v => updateContractingType(type, { toMonth: parseInt(v) })}
                                                    >
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {MONTHS.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                </div>

                <DialogFooter className="px-6 py-4 border-t bg-background">
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        <Save className="h-4 w-4 mr-2" />
                        {isSubmitting ? "Saving…" : editingAccount ? "Save Changes" : "Create Account"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
