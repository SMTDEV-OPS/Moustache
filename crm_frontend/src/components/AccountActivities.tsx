import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Calendar, User } from "lucide-react";
import { getAccountContacts } from "@/services/contacts";
import type { Contact } from "@/services/contacts";
import {
    listContactActivities,
    createContactActivity,
    type ContactActivity,
    type ContactActivityType,
} from "@/services/contactActivities";

const ACTIVITY_TYPES: { value: ContactActivityType; label: string }[] = [
    { value: "SALES_CALL", label: "Sales Call" },
    { value: "TELECALL", label: "Tele Call" },
    { value: "EMAIL", label: "Email" },
    { value: "CLIENT_SITE_INSPECTION", label: "Client Site Inspection" },
];

interface AccountActivitiesProps {
    accountId: string;
}

export function AccountActivities({ accountId }: AccountActivitiesProps) {
    const { toast } = useToast();
    const [activities, setActivities] = useState<ContactActivity[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [contactFilter, setContactFilter] = useState<string>("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState({
        contactId: "",
        activityType: "SALES_CALL" as ContactActivityType,
        purpose: "",
        discussion: "",
        output: "",
        followUp: "",
    });

    const keyPersonnel = contacts.filter((c) => c.isKeyPersonnel);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                const [acts, conts] = await Promise.all([
                    listContactActivities(accountId, contactFilter || undefined),
                    getAccountContacts(accountId),
                ]);
                if (!cancelled) {
                    setActivities(acts);
                    setContacts(conts);
                }
            } catch (err) {
                if (!cancelled) toast({ title: "Error", description: "Failed to load activities", variant: "destructive" });
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [accountId, contactFilter, toast]);

    const handleSubmit = async () => {
        if (!form.contactId) {
            toast({ title: "Validation", description: "Select a contact", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const created = await createContactActivity({
                accountId,
                contactId: form.contactId,
                activityType: form.activityType,
                purpose: form.purpose || undefined,
                discussion: form.discussion || undefined,
                output: form.output || undefined,
                followUp: form.followUp || undefined,
            });
            setActivities((prev) => [created, ...prev]);
            setIsDialogOpen(false);
            setForm({ contactId: "", activityType: "SALES_CALL", purpose: "", discussion: "", output: "", followUp: "" });
            toast({ title: "Success", description: "Activity added" });
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to add activity", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (d: string) => {
        try {
            return new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" });
        } catch {
            return d;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Label className="text-sm text-muted-foreground">Filter by Key Personnel</Label>
                    <Select value={contactFilter || "__all__"} onValueChange={(v) => setContactFilter(v === "__all__" ? "" : v)}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="All contacts" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">All contacts</SelectItem>
                            {keyPersonnel.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                            {keyPersonnel.length === 0 && (
                                <SelectItem value="_none" disabled>No key personnel</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Activity
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : activities.length === 0 ? (
                <Card className="border-border">
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No activities yet. Add an activity to record Purpose, Discussion, Output and Follow-up.</p>
                        <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>Add Activity</Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {activities.map((a) => (
                        <Card key={a.id} className="border-border">
                            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">{a.activityType.replace(/_/g, " ")}</Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDate(a.performedAt)}
                                        {(a as any).contactId?.name && ` · ${(a as any).contactId.name}`}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="px-4 pb-4 pt-0 space-y-2 text-sm">
                                {a.purpose && (
                                    <div>
                                        <span className="font-medium text-muted-foreground">Purpose: </span>
                                        <span>{a.purpose}</span>
                                    </div>
                                )}
                                {a.discussion && (
                                    <div>
                                        <span className="font-medium text-muted-foreground">Discussion: </span>
                                        <span>{a.discussion}</span>
                                    </div>
                                )}
                                {a.output && (
                                    <div>
                                        <span className="font-medium text-muted-foreground">Output: </span>
                                        <span>{a.output}</span>
                                    </div>
                                )}
                                {a.followUp && (
                                    <div>
                                        <span className="font-medium text-muted-foreground">Follow-up: </span>
                                        <span>{a.followUp}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add Activity</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Contact (Key Personnel)</Label>
                            <Select value={form.contactId} onValueChange={(v) => setForm({ ...form, contactId: v })}>
                                <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                                <SelectContent>
                                    {contacts.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}{c.isKeyPersonnel ? " (Key)" : ""}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Activity Type</Label>
                            <Select value={form.activityType} onValueChange={(v) => setForm({ ...form, activityType: v as ContactActivityType })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {ACTIVITY_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Purpose</Label>
                            <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Purpose of the activity" />
                        </div>
                        <div className="space-y-2">
                            <Label>Discussion</Label>
                            <Input value={form.discussion} onChange={(e) => setForm({ ...form, discussion: e.target.value })} placeholder="What was discussed" />
                        </div>
                        <div className="space-y-2">
                            <Label>Output</Label>
                            <Input value={form.output} onChange={(e) => setForm({ ...form, output: e.target.value })} placeholder="Outcome / output" />
                        </div>
                        <div className="space-y-2">
                            <Label>Follow-up</Label>
                            <Input value={form.followUp} onChange={(e) => setForm({ ...form, followUp: e.target.value })} placeholder="Next steps / follow-up" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Save Activity
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
