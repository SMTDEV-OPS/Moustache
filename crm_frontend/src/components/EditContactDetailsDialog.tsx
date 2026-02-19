import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { LeadContactDetails } from "@/services/leads";

interface EditContactDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentContactDetails: LeadContactDetails;
    onSave: (contactDetails: LeadContactDetails) => Promise<void>;
}

export function EditContactDetailsDialog({
    open,
    onOpenChange,
    currentContactDetails,
    onSave,
}: EditContactDetailsDialogProps) {
    const [name, setName] = useState(currentContactDetails.name);
    const [phone, setPhone] = useState(currentContactDetails.phone || "");
    const [email, setEmail] = useState(currentContactDetails.email || "");
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

    const validateForm = () => {
        const newErrors: { name?: string; email?: string } = {};

        if (!name.trim()) {
            newErrors.name = "Name is required";
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = "Invalid email format";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        try {
            setIsSaving(true);
            await onSave({
                name: name.trim(),
                phone: phone.trim() || undefined,
                email: email.trim() || undefined,
            });
            onOpenChange(false);
        } catch (error) {
            // Error handling is done in parent component
        } finally {
            setIsSaving(false);
        }
    };

    // Reset form when dialog opens
    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) {
            setName(currentContactDetails.name);
            setPhone(currentContactDetails.phone || "");
            setEmail(currentContactDetails.email || "");
            setErrors({});
        }
        onOpenChange(newOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Contact Details</DialogTitle>
                    <DialogDescription>
                        Update the contact information for this lead inquiry. This won't
                        affect the guest profile.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">
                            Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Guest name"
                            className={errors.name ? "border-red-500" : ""}
                        />
                        {errors.name && (
                            <p className="text-sm text-red-500">{errors.name}</p>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                            id="phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+91 98765 43210"
                            type="tel"
                        />
                        <p className="text-xs text-muted-foreground">
                            Will be automatically formatted
                        </p>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="guest@example.com"
                            type="email"
                            className={errors.email ? "border-red-500" : ""}
                        />
                        {errors.email && (
                            <p className="text-sm text-red-500">{errors.email}</p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save Changes"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
