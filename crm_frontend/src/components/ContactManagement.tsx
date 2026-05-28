import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    Loader2, Plus, Trash2, Edit, Phone, Mail, User,
    Cake, Star, CalendarClock,
} from "lucide-react";
import { SetFollowUpDialog } from "@/components/followup/SetFollowUpDialog";
import {
    Contact,
    getAccountContacts,
    deleteContact,
    ClientStatus,
} from "@/services/contacts";
import { ContactWizard } from "@/components/contacts/ContactWizard";

interface ContactManagementProps {
    accountId: string;
    permissions?: string[];
    isAdmin?: boolean;
    isSystemAdmin?: boolean;
    currentUserId?: string;
    openAddContactOnMount?: boolean;
    onAddContactDialogOpened?: () => void;
    canCreateLeadFromContact?: (contact: Contact) => boolean;
    accountName?: string;
    onViewLead?: (leadId: string) => void;
}

export const ContactManagement = ({
    accountId,
    accountName,
    openAddContactOnMount,
    onAddContactDialogOpened,
}: ContactManagementProps) => {
    const { toast } = useToast();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [followUpContactId, setFollowUpContactId] = useState<string | null>(null);

    useEffect(() => {
        loadContacts();
    }, [accountId]);

    useEffect(() => {
        if (openAddContactOnMount) {
            handleOpenDialog();
            onAddContactDialogOpened?.();
        }
    }, [openAddContactOnMount]);

    const loadContacts = async () => {
        try {
            setIsLoading(true);
            const data = await getAccountContacts(accountId);
            setContacts(data);
        } catch {
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
        setEditingContact(contact ?? null);
        setIsDialogOpen(true);
    };

    const handleDelete = async (contactId: string) => {
        if (!confirm("Are you sure?")) return;
        try {
            await deleteContact(contactId);
            toast({ title: "Success", description: "Contact deleted" });
            loadContacts();
        } catch {
            toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
        }
    };

    const getStatusBadge = (status: ClientStatus) => {
        switch (status) {
            case "PROMOTER": return <Badge className="bg-emerald-600 hover:bg-emerald-600">Promoter</Badge>;
            case "DETRACTOR": return <Badge variant="destructive">Detractor</Badge>;
            default: return <Badge variant="secondary">Neutral</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-text">Account contacts</h3>
                    <p className="text-sm text-text-muted">Manage key personnel and stakeholders</p>
                </div>
                <Button onClick={() => handleOpenDialog()}>
                    <Plus className="mr-2 h-4 w-4" /> Add contact
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contacts.map(contact => (
                    <Card key={contact.id} className="border-border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        {contact.isKeyPersonnel && (
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" title="Key Personnel" />
                        )}
                        <CardHeader className="p-4 pb-2">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <div className="h-10 w-10 rounded-full bg-hover flex items-center justify-center text-text font-bold shrink-0">
                                        {contact.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-base truncate">{contact.title} {contact.name}</CardTitle>
                                        <CardDescription className="truncate text-xs">{contact.designation || "No designation"}</CardDescription>
                                    </div>
                                </div>
                                {getStatusBadge(contact.clientStatus)}
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-3">
                            <div className="space-y-1.5">
                                {contact.mobileNumber1 && (
                                    <div className="flex items-center gap-2 text-sm text-text-muted">
                                        <Phone className="h-3.5 w-3.5 shrink-0" />
                                        <span>{contact.mobileNumber1}</span>
                                    </div>
                                )}
                                {contact.email && (
                                    <div className="flex items-center gap-2 text-sm text-text-muted">
                                        <Mail className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{contact.email}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {contact.isKeyPersonnel && (
                                    <Badge variant="outline" className="text-[10px] font-medium text-primary border-primary">
                                        {contact.keyPersonnelRole?.replace(/_/g, " ")}
                                    </Badge>
                                )}
                                {contact.isLoyaltyMember && (
                                    <Badge variant="outline" className="text-[10px] font-medium text-amber-700 border-amber-300">
                                        <Star className="h-3 w-3 mr-1 fill-amber-600" /> Member
                                    </Badge>
                                )}
                                {contact.dateOfBirth && (
                                    <Badge variant="outline" className="text-[10px]">
                                        <Cake className="h-3 w-3 mr-1" /> DOB
                                    </Badge>
                                )}
                            </div>

                            <div className="pt-2 flex justify-end gap-2 border-t border-border">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs"
                                    title="Set follow-up"
                                    onClick={() => setFollowUpContactId(contact.id)}
                                >
                                    <CalendarClock className="h-3.5 w-3.5 mr-1" />
                                    Follow-up
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenDialog(contact)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(contact.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {contacts.length === 0 && (
                <div className="text-center py-20 bg-hover/30 rounded-lg border border-dashed border-border">
                    <User className="h-12 w-12 text-text-muted mx-auto mb-3 opacity-50" />
                    <p className="text-text-muted font-medium">No contacts added yet</p>
                    <Button variant="link" onClick={() => handleOpenDialog()} className="mt-1">
                        Add your first contact
                    </Button>
                </div>
            )}

            <ContactWizard
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                accountId={accountId}
                editingContact={editingContact}
                onSuccess={loadContacts}
            />

            <SetFollowUpDialog
                open={followUpContactId !== null}
                onOpenChange={(open) => { if (!open) setFollowUpContactId(null); }}
                accountId={accountId}
                accountName={accountName}
                preselectedContactId={followUpContactId ?? undefined}
                onSaved={loadContacts}
            />
        </div>
    );
};
