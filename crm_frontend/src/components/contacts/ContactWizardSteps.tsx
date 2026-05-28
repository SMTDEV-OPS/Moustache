import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { Contact } from "@/services/contacts";
import { CLIENT_STATUS_OPTIONS, CONTACT_ROLES } from "./contactFormTypes";

export interface ContactStepContext {
  formData: Partial<Contact>;
  set: (patch: Partial<Contact>) => void;
  errors: Record<string, string>;
  clearError: (key: string) => void;
}

export function ContactStepIdentity({ formData, set, errors, clearError }: ContactStepContext) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="space-y-1.5">
        <Label>
          Full name <span className="text-destructive">*</span>
        </Label>
        <div className="flex gap-2">
          <Select value={formData.title} onValueChange={(v) => set({ title: v })}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
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
                set({ name: e.target.value });
                clearError("name");
              }}
              placeholder="Enter full name"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Designation</Label>
          <Input
            value={formData.designation}
            onChange={(e) => set({ designation: e.target.value })}
            placeholder="e.g. Sales Director"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => {
              set({ email: e.target.value });
              clearError("email");
            }}
            placeholder="email@company.com"
            className={errors.email ? "border-destructive" : ""}
          />
          {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
        </div>
      </div>
    </div>
  );
}

export function ContactStepReach({ formData, set }: ContactStepContext) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Mobile number 1</Label>
          <Input
            value={formData.mobileNumber1}
            onChange={(e) => set({ mobileNumber1: e.target.value })}
            placeholder="+91..."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Mobile number 2</Label>
          <Input
            value={formData.mobileNumber2}
            onChange={(e) => set({ mobileNumber2: e.target.value })}
            placeholder="+91..."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Board number</Label>
          <Input
            value={formData.boardNumber}
            onChange={(e) => set({ boardNumber: e.target.value })}
            placeholder="Board line"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Office number</Label>
          <Input
            value={formData.officeNumber}
            onChange={(e) => set({ officeNumber: e.target.value })}
            placeholder="Office direct"
          />
        </div>
      </div>
    </div>
  );
}

export function ContactStepRole({ formData, set, errors, clearError }: ContactStepContext) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="isKey"
          checked={formData.isKeyPersonnel}
          onCheckedChange={(checked) => set({ isKeyPersonnel: !!checked, keyPersonnelRole: checked ? formData.keyPersonnelRole : undefined })}
        />
        <Label htmlFor="isKey" className="cursor-pointer font-medium">
          Key personnel / decision maker
        </Label>
      </div>
      {formData.isKeyPersonnel && (
        <div className="space-y-1.5 pl-6 border-l-2 border-primary/20">
          <Label>
            Organization role <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.keyPersonnelRole}
            onValueChange={(v) => {
              set({ keyPersonnelRole: v as Contact["keyPersonnelRole"] });
              clearError("keyPersonnelRole");
            }}
          >
            <SelectTrigger className={errors.keyPersonnelRole ? "border-destructive" : ""}>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.keyPersonnelRole && (
            <p className="text-xs text-destructive">{errors.keyPersonnelRole}</p>
          )}
        </div>
      )}
      <div className="space-y-1.5 pt-2 border-t border-border">
        <Label>Client status</Label>
        <Select
          value={formData.clientStatus}
          onValueChange={(v) => set({ clientStatus: v as Contact["clientStatus"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLIENT_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function ContactStepLoyalty({ formData, set, errors, clearError }: ContactStepContext) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="isLoyalty"
          checked={formData.isLoyaltyMember}
          onCheckedChange={(checked) =>
            set({
              isLoyaltyMember: !!checked,
              loyaltyNumber: checked ? formData.loyaltyNumber : "",
              loyaltyProgramName: checked ? formData.loyaltyProgramName : "",
            })
          }
        />
        <Label htmlFor="isLoyalty" className="cursor-pointer">
          Registered in loyalty program
        </Label>
      </div>
      {formData.isLoyaltyMember && (
        <div className="grid grid-cols-1 gap-3 pl-6 border-l-2 border-primary/20">
          <div className="space-y-1.5">
            <Label>
              Loyalty membership number <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.loyaltyNumber}
              onChange={(e) => {
                set({ loyaltyNumber: e.target.value });
                clearError("loyaltyNumber");
              }}
              placeholder="Enter membership number"
              className={errors.loyaltyNumber ? "border-destructive" : ""}
            />
            {errors.loyaltyNumber && (
              <p className="text-xs text-destructive">{errors.loyaltyNumber}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Program name (optional)</Label>
            <Input
              value={formData.loyaltyProgramName}
              onChange={(e) => set({ loyaltyProgramName: e.target.value })}
              placeholder="e.g. Sunshine Rewards"
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div className="space-y-1.5">
          <Label>Birthday</Label>
          <Input
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => set({ dateOfBirth: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Wedding anniversary</Label>
          <Input
            type="date"
            value={formData.weddingAnniversary}
            onChange={(e) => set({ weddingAnniversary: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export function ContactReviewSummary({ formData }: { formData: Partial<Contact> }) {
  const roleLabel = CONTACT_ROLES.find((r) => r.value === formData.keyPersonnelRole)?.label;
  const statusLabel = CLIENT_STATUS_OPTIONS.find((s) => s.value === formData.clientStatus)?.label;

  return (
    <div className="rounded-lg border border-border bg-hover/40 p-4 space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <span className="text-text-muted">Name</span>
          <p className="font-medium text-text">
            {formData.title} {formData.name || "—"}
          </p>
        </div>
        <div>
          <span className="text-text-muted">Email</span>
          <p className="font-medium text-text">{formData.email || "—"}</p>
        </div>
        <div>
          <span className="text-text-muted">Mobile</span>
          <p className="font-medium text-text">{formData.mobileNumber1 || "—"}</p>
        </div>
        <div>
          <span className="text-text-muted">Status</span>
          <p className="font-medium text-text">{statusLabel || "—"}</p>
        </div>
        {formData.isKeyPersonnel && (
          <div>
            <span className="text-text-muted">Role</span>
            <p className="font-medium text-text">{roleLabel || "—"}</p>
          </div>
        )}
        {formData.isLoyaltyMember && (
          <div>
            <span className="text-text-muted">Loyalty #</span>
            <p className="font-medium text-text">{formData.loyaltyNumber || "—"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
