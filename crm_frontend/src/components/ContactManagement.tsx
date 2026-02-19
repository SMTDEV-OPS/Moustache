import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    Loader2, Plus, Trash2, Edit, Phone, Mail, User,
    Cake, Heart, Shield, Crown, Star, MoreHorizontal
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Contact,
    getAccountContacts,
    createContact,
    updateContact,
    deleteContact,
    ClientStatus,
    KeyPersonnelRole
} from "@/services/contacts";

interface ContactManagementProps {
    accountId: string;
}

const ROLES: { value: KeyPersonnelRole; label: string }[] = [
    { value: "ADMIN_HEAD", label: "Admin Head" },
    { value: "FINANCE_HEAD", label: "Finance Head" },
    { value: "SALES_HEAD", label: "Sales Head" },
    { value: "MARKETING_HEAD", label: "Marketing Head" },
    { value: "COUNTRY_CITY_HEAD", label: "Country/City Head" },
    { value: "ASSISTANT", label: "Assistant" },
    { value: "HR_HEAD", label: "HR Head" },
    { value: "TRAINING_HEAD", label: "Training Head" },
];

export const ContactManagement = ({ accountId }: ContactManagementProps) => {
    const { toast } = useToast();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState<Partial<Contact>>({
        name: "",
        title: "Mr.",
        designation: "",
        isKeyPersonnel: false,
        keyPersonnelRole: undefined,
        email: "",
        mobileNumber1: "",
        mobileNumber2: "",
        boardNumber: "",
        officeNumber: "",
        clientStatus: "NEUTRAL",
        isLoyaltyMember: false,
        loyaltyProgramName: "",
        loyaltyNumber: "",
        dateOfBirth: "",
        weddingAnniversary: "",
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        loadContacts();
    }, [accountId]);

    const loadContacts = async () => {
        try {
            setIsLoading(true);
            const data = await getAccountContacts(accountId);
            setContacts(data);
        } catch (err) {
            toast({
                title: "Error",
                description: "Failed to load contacts",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenDialog = (contact?: Contact) => {
        setErrors({}); // Clear errors on open
        if (contact) {
            setEditingContact(contact);
            setFormData(contact);
        } else {
            setEditingContact(null);
            setFormData({
                name: "",
                title: "Mr.",
                designation: "",
                isKeyPersonnel: false,
                keyPersonnelRole: undefined,
                email: "",
                mobileNumber1: "",
                mobileNumber2: "",
                boardNumber: "",
                officeNumber: "",
                clientStatus: "NEUTRAL",
                isLoyaltyMember: false,
                loyaltyProgramName: "",
                loyaltyNumber: "",
                dateOfBirth: "",
                weddingAnniversary: "",
            });
        }
        setIsDialogOpen(true);
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.name?.trim()) {
            newErrors.name = "Full Name is required";
        }

        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = "Invalid email address";
        }

        if (formData.isKeyPersonnel && !formData.keyPersonnelRole) {
            newErrors.keyPersonnelRole = "Role is required for Key Personnel";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            toast({ title: "Validation Error", description: "Please check the form for errors", variant: "destructive" });
            return;
        }

        // Sanitize payload: remove empty strings for optional fields
        const cleanPayload = (data: Partial<Contact>) => {
            const cleaned = { ...data };
            if (!cleaned.email) delete cleaned.email;
            if (!cleaned.mobileNumber1) delete cleaned.mobileNumber1;
            if (!cleaned.mobileNumber2) delete cleaned.mobileNumber2;
            if (!cleaned.boardNumber) delete cleaned.boardNumber;
            if (!cleaned.officeNumber) delete cleaned.officeNumber;
            if (!cleaned.dateOfBirth) delete cleaned.dateOfBirth;
            if (!cleaned.weddingAnniversary) delete cleaned.weddingAnniversary;
            if (!cleaned.loyaltyProgramName) delete cleaned.loyaltyProgramName;
            if (!cleaned.loyaltyNumber) delete cleaned.loyaltyNumber;
            if (!cleaned.designation) delete cleaned.designation;

            // Handle key personnel role
            if (!cleaned.isKeyPersonnel) {
                delete cleaned.keyPersonnelRole;
            }
            return cleaned;
        };

        try {
            setIsSubmitting(true);
            const payload = cleanPayload(formData);

            if (editingContact) {
                await updateContact(editingContact.id, payload);
                toast({ title: "Success", description: "Contact updated" });
            } else {
                await createContact(accountId, payload as Omit<Contact, "id">);
                toast({ title: "Success", description: "Contact created" });
            }
            setIsDialogOpen(false);
            loadContacts();
        } catch (err) {
            toast({ title: "Error", description: "Failed to save contact", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (contactId: string) => {
        if (!confirm("Are you sure?")) return;
        try {
            await deleteContact(contactId);
            toast({ title: "Success", description: "Contact deleted" });
            loadContacts();
        } catch (err) {
            toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
        }
    };

    const getStatusBadge = (status: ClientStatus) => {
        switch (status) {
            case "PROMOTER": return <Badge className="bg-emerald-500 hover:bg-emerald-600">Promoter</Badge>;
            case "DETRACTOR": return <Badge variant="destructive">Detractor</Badge>;
            default: return <Badge variant="secondary">Neutral</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Account Contacts</h3>
                    <p className="text-sm text-slate-500">Manage key personnel and stakeholders</p>
                </div>
                <Button onClick={() => handleOpenDialog()} className="bg-slate-900 hover:bg-slate-800 text-white rounded-none">
                    <Plus className="mr-2 h-4 w-4" /> Add Contact
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contacts.map(contact => (
                    <Card key={contact.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        {contact.isKeyPersonnel && (
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" title="Key Personnel" />
                        )}
                        <CardHeader className="p-4 pb-2">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold shrink-0">
                                        {contact.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-base truncate">{contact.title} {contact.name}</CardTitle>
                                        <CardDescription className="truncate text-xs">{contact.designation || "No Designation"}</CardDescription>
                                    </div>
                                </div>
                                {getStatusBadge(contact.clientStatus)}
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-3">
                            <div className="space-y-1.5">
                                {contact.mobileNumber1 && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Phone className="h-3.5 w-3.5 shrink-0" />
                                        <span>{contact.mobileNumber1}</span>
                                    </div>
                                )}
                                {contact.email && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Mail className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{contact.email}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {contact.isKeyPersonnel && (
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary">
                                        {contact.keyPersonnelRole?.replace(/_/g, " ")}
                                    </Badge>
                                )}
                                {contact.isLoyaltyMember && (
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-amber-600 border-amber-600">
                                        <Star className="h-3 w-3 mr-1 fill-amber-600" /> Member
                                    </Badge>
                                )}
                                {contact.dateOfBirth && (
                                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-100">
                                        <Cake className="h-3 w-3 mr-1" /> DOB
                                    </Badge>
                                )}
                            </div>

                            <div className="pt-2 flex justify-end gap-2 border-t border-slate-50">
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenDialog(contact)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(contact.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {contacts.length === 0 && (
                <div className="text-center py-20 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    <User className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No contacts added yet</p>
                    <Button variant="link" onClick={() => handleOpenDialog()} className="text-primary mt-1">
                        Add your first contact
                    </Button>
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingContact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                        <div className="space-y-2 col-span-2">
                            <Label>Full Name *</Label>
                            <div className="flex gap-2">
                                <Select value={formData.title} onValueChange={(v) => setFormData({ ...formData, title: v })}>
                                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Mr.">Mr.</SelectItem>
                                        <SelectItem value="Ms.">Ms.</SelectItem>
                                        <SelectItem value="Mrs.">Mrs.</SelectItem>
                                        <SelectItem value="Dr.">Dr.</SelectItem>
                                    </SelectContent>
                                </Select>
                                <div className="flex-1">
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => {
                                            setFormData({ ...formData, name: e.target.value });
                                            if (errors.name) setErrors({ ...errors, name: "" });
                                        }}
                                        placeholder="Enter full name"
                                        className={errors.name ? "border-red-500" : ""}
                                    />
                                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Designation</Label>
                            <Input value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} placeholder="e.g. Sales Director" />
                        </div>

                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                value={formData.email}
                                onChange={(e) => {
                                    setFormData({ ...formData, email: e.target.value });
                                    if (errors.email) setErrors({ ...errors, email: "" });
                                }}
                                type="email"
                                placeholder="email@company.com"
                                className={errors.email ? "border-red-500" : ""}
                            />
                            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label>Mobile Number 1</Label>
                            <Input value={formData.mobileNumber1} onChange={(e) => setFormData({ ...formData, mobileNumber1: e.target.value })} placeholder="+91..." />
                        </div>

                        <div className="space-y-2">
                            <Label>Mobile Number 2</Label>
                            <Input value={formData.mobileNumber2} onChange={(e) => setFormData({ ...formData, mobileNumber2: e.target.value })} placeholder="+91..." />
                        </div>

                        <div className="bg-slate-50 p-4 rounded-lg col-span-2 space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="isKey"
                                    checked={formData.isKeyPersonnel}
                                    onCheckedChange={(checked) => setFormData({ ...formData, isKeyPersonnel: !!checked })}
                                />
                                <Label htmlFor="isKey" className="font-bold text-slate-900">Key Personnel / Decision Maker</Label>
                            </div>

                            {formData.isKeyPersonnel && (
                                <div className="space-y-2 pl-6">
                                    <Label>Organization Role *</Label>
                                    <Select
                                        value={formData.keyPersonnelRole}
                                        onValueChange={(v) => {
                                            setFormData({ ...formData, keyPersonnelRole: v as KeyPersonnelRole });
                                            if (errors.keyPersonnelRole) setErrors({ ...errors, keyPersonnelRole: "" });
                                        }}
                                    >
                                        <SelectTrigger className={errors.keyPersonnelRole ? "border-red-500" : ""}>
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    {errors.keyPersonnelRole && <p className="text-xs text-red-500 mt-1">{errors.keyPersonnelRole}</p>}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Client Status</Label>
                            <Select value={formData.clientStatus} onValueChange={(v) => setFormData({ ...formData, clientStatus: v as ClientStatus })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PROMOTER">Promoter (High Support)</SelectItem>
                                    <SelectItem value="NEUTRAL">Neutral</SelectItem>
                                    <SelectItem value="DETRACTOR">Detractor (Risk)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Loyalty Member?</Label>
                            <div className="flex items-center h-10 space-x-2">
                                <Checkbox
                                    id="isLoyalty"
                                    checked={formData.isLoyaltyMember}
                                    onCheckedChange={(checked) => setFormData({ ...formData, isLoyaltyMember: !!checked })}
                                />
                                <Label htmlFor="isLoyalty">Registered in Loyalty Program</Label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Birthday</Label>
                            <Input value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} type="date" />
                        </div>

                        <div className="space-y-2">
                            <Label>Wedding Anniversary</Label>
                            <Input value={formData.weddingAnniversary} onChange={(e) => setFormData({ ...formData, weddingAnniversary: e.target.value })} type="date" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-slate-900 text-white">
                            {isSubmitting ? "Saving..." : "Save Contact"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
