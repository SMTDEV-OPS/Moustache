import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Save, Building2, User, Phone, MapPin, Briefcase, TrendingUp } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface AccountCreationWizardProps {
    isOpen: boolean;
    onClose: () => void;
    editingAccount?: Account | null;
    onSuccess: () => void;
}

const STEPS = [
    "Account Information",
    "Organization Type",
    "Conglomerate",
    "Headquarter Status",
    "Account Level",
    "Relationship Link",
    "Account Type",
    "Regional Information",
    "Sales Assignment",
    "Industry Category",
    "Industry Sub-Category",
    "Contracting Type",
    "Address & Identification"
];

export const AccountCreationWizard = ({ isOpen, onClose, editingAccount, onSuccess }: AccountCreationWizardProps) => {
    const { toast } = useToast();
    const [currentStep, setCurrentStep] = useState(0);
    const [conglomerates, setConglomerates] = useState<Conglomerate[]>([]);
    const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState<any>({
        name: "",
        organizationType: "CORPORATE",
        customOrganizationType: "",
        conglomerateId: null,
        accountLevel: "MASTER",
        isHeadquarter: false,
        headquarterName: "",
        accountType: "ACQUISITION",
        parentAccountId: null,
        city: "",
        state: "",
        locality: "",
        country: "India",
        gstin: "",
        panNumber: "",
        industryCategory: "",
        industrySubCategory: "",
        industrySize: "MEDIUM",
        contractingTypes: [],
        primaryAccountManager: { userId: "", name: "", city: "" },
        secondaryAccountManagers: [],
    });

    useEffect(() => {
        if (editingAccount) {
            setFormData({
                ...formData,
                ...editingAccount,
                conglomerateId: editingAccount.conglomerateId || null,
                parentAccountId: editingAccount.parentAccountId || null,
            });
        } else {
            setFormData({
                name: "",
                organizationType: "CORPORATE",
                customOrganizationType: "",
                conglomerateId: null,
                accountLevel: "MASTER",
                isHeadquarter: false,
                headquarterName: "",
                accountType: "ACQUISITION",
                parentAccountId: null,
                city: "",
                state: "",
                locality: "",
                country: "India",
                gstin: "",
                panNumber: "",
                industryCategory: "",
                industrySubCategory: "",
                industrySize: "MEDIUM",
                contractingTypes: [],
                primaryAccountManager: { userId: "", name: "", city: "" },
                secondaryAccountManagers: [],
            });
        }
    }, [editingAccount, isOpen]);

    useEffect(() => {
        const fetchRefData = async () => {
            try {
                const [congs, accs] = await Promise.all([
                    listConglomerates(),
                    listAccounts()
                ]);
                setConglomerates(congs);
                setAvailableAccounts(accs);
            } catch (err) {
                console.error("Failed to fetch reference data:", err);
            }
        };
        if (isOpen) fetchRefData();
    }, [isOpen]);

    const handleNext = () => {
        if (currentStep === 0 && !formData.name) {
            toast({ title: "Validation Error", description: "Account Name is required", variant: "destructive" });
            return;
        }
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleSubmit();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) setCurrentStep(currentStep - 1);
    };

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);

            // Sanitize payload before sending to API
            const sanitizedData = { ...formData };

            // 1. Map modern organizationType to legacy required type field
            if (!sanitizedData.type) {
                const orgTypeToLegacy: Record<string, string> = {
                    "CORPORATE": "CORPORATE",
                    "TRAVEL_AGENT": "TRAVEL_AGENT",
                    "EVENT_PLANNER": "EVENT_PLANNER",
                    "PCO": "EVENT_PLANNER",
                    "AIRLINE": "AIRLINES",
                    "GOVERNMENT": "GOVERNMENT",
                    "EMBASSY_CONSULATE": "GOVERNMENT",
                    "PSU": "GOVERNMENT",
                    "CUSTOM": "OTHER"
                };
                sanitizedData.type = orgTypeToLegacy[sanitizedData.organizationType] || "OTHER";
            }

            // 2. Handle null/empty reference IDs
            if (sanitizedData.conglomerateId === "" || sanitizedData.conglomerateId === null) {
                delete sanitizedData.conglomerateId;
            }
            if (sanitizedData.parentAccountId === "" || sanitizedData.parentAccountId === null) {
                delete sanitizedData.parentAccountId;
            }

            // 3. Clean up Account Managers (Remove empty entries or missing userIds)
            if (sanitizedData.primaryAccountManager) {
                if (!sanitizedData.primaryAccountManager.name && !sanitizedData.primaryAccountManager.userId) {
                    delete sanitizedData.primaryAccountManager;
                } else if (sanitizedData.primaryAccountManager.userId === "") {
                    // Backend may fail if userId is passed as empty string
                    const { userId, ...rest } = sanitizedData.primaryAccountManager;
                    sanitizedData.primaryAccountManager = rest;
                }
            }

            if (sanitizedData.secondaryAccountManagers && Array.isArray(sanitizedData.secondaryAccountManagers)) {
                sanitizedData.secondaryAccountManagers = sanitizedData.secondaryAccountManagers
                    .filter((m: any) => (m.name && m.name.trim() !== "") || (m.userId && m.userId.trim() !== ""))
                    .map((m: any) => {
                        const sanitizedM = { ...m };
                        if (sanitizedM.userId === "") delete sanitizedM.userId;
                        return sanitizedM;
                    });
            }

            // 4. Remove empty strings for other optional fields
            Object.keys(sanitizedData).forEach(key => {
                if (sanitizedData[key] === "") {
                    delete sanitizedData[key];
                }
            });

            if (editingAccount) {
                await updateAccount(editingAccount.id, sanitizedData);
            } else {
                await createAccount(sanitizedData);
            }

            toast({
                title: "Success",
                description: editingAccount ? "Account updated successfully" : "Account created successfully"
            });
            onSuccess();
            onClose();
        } catch (err) {
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Failed to save account. Please check all fields.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 0: // Account Information
                return (
                    <div className="space-y-4">
                        <Label>1st Step: Account Name (Company Name)</Label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Enter legal entity name"
                            className="text-lg"
                        />
                    </div>
                );
            case 1: // Organization Type
                return (
                    <div className="space-y-4">
                        <Label>2nd Step: Choose Organization Type</Label>
                        <Select
                            value={formData.organizationType}
                            onValueChange={(v) => setFormData({ ...formData, organizationType: v })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                {ORGANIZATION_TYPES.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {formData.organizationType === "CUSTOM" && (
                            <Input
                                value={formData.customOrganizationType}
                                onChange={(e) => setFormData({ ...formData, customOrganizationType: e.target.value })}
                                placeholder="Specify type"
                            />
                        )}
                    </div>
                );
            case 2: // Conglomerate
                return (
                    <div className="space-y-4">
                        <Label>3rd Step: Is it part of a Conglomerate?</Label>
                        <Select
                            value={formData.conglomerateId || "none"}
                            onValueChange={(v) => setFormData({ ...formData, conglomerateId: v === "none" ? null : v })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select conglomerate" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No / Individual</SelectItem>
                                {conglomerates.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.country})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                );
            case 3: // HQ Status
                return (
                    <div className="space-y-4">
                        <Label>4th Step: Headquarter Status</Label>
                        <div className="flex items-center space-x-2 p-4 border rounded-lg">
                            <Checkbox
                                id="isHq"
                                checked={formData.isHeadquarter}
                                onCheckedChange={(v) => setFormData({ ...formData, isHeadquarter: !!v })}
                            />
                            <label htmlFor="isHq" className="font-medium">Is this the Headquarter?</label>
                        </div>
                        {formData.isHeadquarter && (
                            <div className="space-y-2">
                                <Label>Headquarter Name (Search existing)</Label>
                                <Input
                                    value={formData.headquarterName}
                                    onChange={(e) => setFormData({ ...formData, headquarterName: e.target.value })}
                                    placeholder="Official HQ name"
                                />
                            </div>
                        )}
                    </div>
                );
            case 4: // Account Level
                return (
                    <div className="space-y-4">
                        <Label>5th Step: Choose Account Level</Label>
                        <div className="grid grid-cols-2 gap-4">
                            {ACCOUNT_LEVELS.map(l => (
                                <div
                                    key={l.value}
                                    className={cn(
                                        "p-4 border rounded-lg cursor-pointer transition-all",
                                        formData.accountLevel === l.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-slate-300"
                                    )}
                                    onClick={() => setFormData({ ...formData, accountLevel: l.value })}
                                >
                                    <p className="font-semibold">{l.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 5: // Parent Link
                return (
                    <div className="space-y-4">
                        <Label>6th Step: Link with Parent/Master Account</Label>
                        <Select
                            value={formData.parentAccountId || "none"}
                            onValueChange={(v) => setFormData({ ...formData, parentAccountId: v === "none" ? null : v })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select parent account" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No Parent (Root level)</SelectItem>
                                {availableAccounts.filter(a => a.id !== editingAccount?.id).map(a => (
                                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.city})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                );
            case 6: // Account Type (Auto check but can override)
                return (
                    <div className="space-y-4">
                        <Label>7th Step: Choose Account Type</Label>
                        <div className="p-4 bg-slate-50 rounded-lg mb-4">
                            <p className="text-sm text-slate-500">Calculated Type based on Revenue: <span className="font-bold text-slate-900">ACQUISITION</span></p>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            {["ACQUISITION", "DEVELOPMENT", "RETENTION"].map(type => (
                                <div
                                    key={type}
                                    className={cn(
                                        "p-4 border rounded-lg cursor-pointer text-center",
                                        formData.accountType === type ? "border-primary bg-primary/5" : ""
                                    )}
                                    onClick={() => setFormData({ ...formData, accountType: type })}
                                >
                                    <p className="text-xs font-bold">{type}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 7: // Regional Information
                return (
                    <div className="space-y-4">
                        <Label>8th Step: Regional / Cluster Information</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Zone</Label>
                                <Select value={formData.zone} onValueChange={(v) => setFormData({ ...formData, zone: v })}>
                                    <SelectTrigger><SelectValue placeholder="Select Zone" /></SelectTrigger>
                                    <SelectContent>
                                        {["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"].map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Country</Label>
                                <Select value={formData.country} onValueChange={(v) => setFormData({ ...formData, country: v })}>
                                    <SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="India">India</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                );
            case 8: // Sales Assignment
                return (
                    <div className="space-y-4">
                        <Label>9th Step: Sales Team Assignment</Label>
                        <div className="p-4 border rounded-lg bg-blue-50/30 border-blue-100">
                            <Label className="text-blue-700">Primary Account Manager (PAM)</Label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <Input
                                    placeholder="Manager Name"
                                    value={formData.primaryAccountManager?.name || ""}
                                    onChange={(e) => setFormData({ ...formData, primaryAccountManager: { ...formData.primaryAccountManager, name: e.target.value } })}
                                />
                                <Input
                                    placeholder="Manager City"
                                    value={formData.primaryAccountManager?.city || ""}
                                    onChange={(e) => setFormData({ ...formData, primaryAccountManager: { ...formData.primaryAccountManager, city: e.target.value } })}
                                />
                            </div>
                        </div>
                        <div className="p-4 border rounded-lg">
                            <Label>Secondary Account Managers (SAM)</Label>
                            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => {
                                const sams = [...(formData.secondaryAccountManagers || []), { userId: "", name: "", city: "" }];
                                setFormData({ ...formData, secondaryAccountManagers: sams });
                            }}>+ Add Secondary Manager</Button>
                        </div>
                    </div>
                );
            case 9: // Industry Category
                return (
                    <div className="space-y-4">
                        <Label>10th Step: Choose Industry Category</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.keys(INDUSTRY_CATEGORIES).map(cat => (
                                <div
                                    key={cat}
                                    className={cn(
                                        "p-3 border rounded cursor-pointer text-sm",
                                        formData.industryCategory === cat ? "bg-primary/5 border-primary" : "hover:bg-slate-50"
                                    )}
                                    onClick={() => setFormData({ ...formData, industryCategory: cat, industrySubCategory: "" })}
                                >
                                    {cat}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 10: // Industry Sub-Category
                return (
                    <div className="space-y-4">
                        <Label>11th Step: Choose Industry Sub-Category</Label>
                        <div className="grid grid-cols-1 gap-2">
                            {formData.industryCategory && INDUSTRY_CATEGORIES[formData.industryCategory]?.map(sub => (
                                <div
                                    key={sub}
                                    className={cn(
                                        "p-3 border rounded cursor-pointer text-sm",
                                        formData.industrySubCategory === sub ? "bg-primary/5 border-primary" : "hover:bg-slate-50"
                                    )}
                                    onClick={() => setFormData({ ...formData, industrySubCategory: sub })}
                                >
                                    {sub}
                                </div>
                            ))}
                            {!formData.industryCategory && <p className="text-slate-400 text-center py-8">Please select a category first</p>}
                        </div>
                    </div>
                );
            case 11: // Contracting Type
                return (
                    <div className="space-y-4">
                        <Label>12th Step: Contracting Type & Timelines</Label>
                        <div className="space-y-4">
                            {["LOCAL_CONTRACTING", "LOCAL_RFP", "GLOBAL_RFP", "ANNUAL_CONTRACT"].map(type => (
                                <div key={type} className="p-4 border rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <Label className="font-bold">{type.replace("_", " ")}</Label>
                                        <Checkbox
                                            checked={formData.contractingTypes?.some((t: any) => t.type === type)}
                                            onCheckedChange={(v) => {
                                                let types = [...(formData.contractingTypes || [])];
                                                if (v) {
                                                    types.push({ type, fromMonth: 4, toMonth: 3 }); // Default April-March
                                                } else {
                                                    types = types.filter((t: any) => t.type !== type);
                                                }
                                                setFormData({ ...formData, contractingTypes: types });
                                            }}
                                        />
                                    </div>
                                    {formData.contractingTypes?.some((t: any) => t.type === type) && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-xs">From Month</Label>
                                                <Select
                                                    value={formData.contractingTypes.find((t: any) => t.type === type).fromMonth.toString()}
                                                    onValueChange={(v) => {
                                                        const types = formData.contractingTypes.map((t: any) => t.type === type ? { ...t, fromMonth: parseInt(v) } : t);
                                                        setFormData({ ...formData, contractingTypes: types });
                                                    }}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">To Month</Label>
                                                <Select
                                                    value={formData.contractingTypes.find((t: any) => t.type === type).toMonth.toString()}
                                                    onValueChange={(v) => {
                                                        const types = formData.contractingTypes.map((t: any) => t.type === type ? { ...t, toMonth: parseInt(v) } : t);
                                                        setFormData({ ...formData, contractingTypes: types });
                                                    }}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 12: // Final Step: Address & IDs
                return (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>GSTIN</Label>
                                <Input value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} placeholder="15 Digit GSTIN" />
                            </div>
                            <div className="space-y-2">
                                <Label>PAN Number</Label>
                                <Input value={formData.panNumber} onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })} placeholder="10 Digit PAN" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>PMS Profile ID</Label>
                            <Input value={formData.pmsProfileId} onChange={(e) => setFormData({ ...formData, pmsProfileId: e.target.value })} placeholder="External System ID" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>City</Label>
                                <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                                    <SelectTrigger><SelectValue placeholder="City" /></SelectTrigger>
                                    <SelectContent>
                                        {MAJOR_INDIAN_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>State</Label>
                                <Select value={formData.state} onValueChange={(v) => setFormData({ ...formData, state: v })}>
                                    <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                                    <SelectContent>
                                        {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Locality / Area</Label>
                            <Input value={formData.locality} onChange={(e) => setFormData({ ...formData, locality: e.target.value })} placeholder="e.g. Bandra Kurla Complex" />
                        </div>
                    </div>
                );
            default:
                return <div className="p-8 text-center text-slate-400">Step {currentStep + 1} UI coming soon...</div>;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl min-h-[500px] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center pr-8">
                        <span>{editingAccount ? "Edit Account Profile" : "New Account Creation Wizard"}</span>
                        <Badge variant="outline" className="text-primary border-primary">Step {currentStep + 1} of {STEPS.length}</Badge>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 py-6">
                    <div className="mb-8">
                        <h3 className="text-xl font-bold text-slate-900">{STEPS[currentStep]}</h3>
                        <p className="text-sm text-slate-500">Provide details for the section below to proceed.</p>
                    </div>

                    {renderStep()}
                </div>

                <div className="flex justify-between items-center pt-6 border-t">
                    <Button variant="ghost" onClick={handleBack} disabled={currentStep === 0}>
                        <ChevronLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <div className="flex space-x-2">
                        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleNext} disabled={isSubmitting}>
                            {isSubmitting ? "Saving..." : currentStep === STEPS.length - 1 ? "Complete Profile" : "Next Step"}
                            {currentStep < STEPS.length - 1 && <ChevronRight className="ml-2 h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
