import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";
import {
  ORGANIZATION_TYPES,
  ACCOUNT_LEVELS,
  INDUSTRY_CATEGORIES,
  MAJOR_INDIAN_CITIES,
  MONTHS,
  getStatesForCity,
} from "@/constants/accountData";
import { Account } from "@/services/accounts";
import { Conglomerate } from "@/services/conglomerates";
import { Property } from "@/services/properties";
import { cn } from "@/lib/utils";
import {
  AccountFormData,
  ACCOUNT_TYPE_OPTIONS,
  buildAccountHierarchyProperties,
  CONTRACTING_TYPE_OPTIONS,
  defaultContractingPeriod,
  formatAccountTypeLabel,
  formatContractingPeriod,
  formatContractingTypeLabel,
} from "./accountFormTypes";

export interface StepContext {
  formData: AccountFormData;
  set: (patch: Partial<AccountFormData>) => void;
  conglomerates: Conglomerate[];
  availableAccounts: Account[];
  properties: Property[];
  editingAccount?: Account | null;
  addSam: () => void;
  removeSam: (i: number) => void;
  updateSam: (i: number, patch: Record<string, string>) => void;
  toggleContractingType: (type: string, checked: boolean) => void;
  updateContractingType: (type: string, patch: Record<string, number>) => void;
}

export function AccountStepOrganization({ formData, set }: StepContext) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="acct-name">
          Account name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="acct-name"
          value={formData.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Legal entity name"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Organization type</Label>
          <Select value={formData.organizationType} onValueChange={(v) => set({ organizationType: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORGANIZATION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {formData.organizationType === "CUSTOM" && (
          <div className="space-y-1.5">
            <Label>Custom type</Label>
            <Input
              value={formData.customOrganizationType}
              onChange={(e) => set({ customOrganizationType: e.target.value })}
              placeholder="Specify type"
            />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="contact@company.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Website</Label>
          <Input
            value={formData.website}
            onChange={(e) => set({ website: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </div>
    </div>
  );
}

export function AccountStepClassification({ formData, set }: StepContext) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Account level</Label>
          <Select value={formData.accountLevel} onValueChange={(v) => set({ accountLevel: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Account type</Label>
          <Select value={formData.accountType} onValueChange={(v) => set({ accountType: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="accountTypeOverride"
            checked={formData.accountTypeOverride}
            onCheckedChange={(v) => set({ accountTypeOverride: !!v })}
          />
          <label htmlFor="accountTypeOverride" className="text-sm cursor-pointer">
            Manual type override
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="isHq"
            checked={formData.profileStatus}
            onCheckedChange={(v) => set({ profileStatus: !!v })}
          />
          <label htmlFor="isHq" className="text-sm cursor-pointer">
            Headquarter account
          </label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div className="space-y-1.5">
          <Label>Industry category</Label>
          <Select
            value={formData.industryCategory || "none"}
            onValueChange={(v) => set({ industryCategory: v === "none" ? "" : v, industrySubCategory: "" })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select —</SelectItem>
              {Object.keys(INDUSTRY_CATEGORIES).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Industry size</Label>
          <Select value={formData.industrySize} onValueChange={(v) => set({ industrySize: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SMALL">Small</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LARGE">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export function AccountStepHierarchy({ formData, set, conglomerates, availableAccounts, properties, editingAccount }: StepContext) {
  const propertyOptions = buildAccountHierarchyProperties(properties);
  const selectableIds = propertyOptions.filter((p) => p.selectable).map((p) => p.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => formData.propertyIds.includes(id));

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      set({ propertyIds: formData.propertyIds.filter((id) => !selectableIds.includes(id)) });
      return;
    }
    const merged = new Set([...formData.propertyIds, ...selectableIds]);
    set({ propertyIds: Array.from(merged) });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Conglomerate</Label>
            <Select
              value={formData.conglomerateId || "none"}
              onValueChange={(v) => set({ conglomerateId: v === "none" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None / Individual</SelectItem>
                {conglomerates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.country})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Parent account</Label>
            <Select
              value={formData.parentAccountId || "none"}
              onValueChange={(v) => set({ parentAccountId: v === "none" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Root level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Root level (no parent)</SelectItem>
                {availableAccounts
                  .filter((a) => a.id !== editingAccount?.id)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.city ? ` · ${a.city}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label>Assign properties</Label>
          {selectableIds.length > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer text-text-muted">
              <Checkbox checked={allSelected} onCheckedChange={(v) => toggleSelectAll(!!v)} />
              <span>Select all</span>
            </label>
          )}
        </div>
        <div className="rounded-md border border-border p-3 space-y-2 max-h-56 overflow-y-auto">
          {propertyOptions.map((property) => {
            const checked = property.selectable && formData.propertyIds.includes(property.id);
            return (
              <label
                key={property.name}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  property.selectable ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={!property.selectable}
                  onCheckedChange={(value) => {
                    if (!property.selectable) return;
                    const next = value
                      ? [...formData.propertyIds, property.id]
                      : formData.propertyIds.filter((id) => id !== property.id);
                    set({ propertyIds: next });
                  }}
                />
                <span>{property.name}</span>
                {property.city && (
                  <span className="text-xs text-text-muted">({property.city})</span>
                )}
              </label>
            );
          })}
        </div>
        {selectableIds.length === 0 && (
          <p className="text-xs text-text-muted">
            Property records are not loaded yet. Refresh or check that hotels exist in the system with matching names.
          </p>
        )}
      </div>
    </div>
  );
}

export function AccountStepLocation({ formData, set }: StepContext) {
  const stateOptions = formData.city ? getStatesForCity(formData.city) : [];

  const handleCityChange = (v: string) => {
    const city = v === "none" ? "" : v;
    const states = city ? getStatesForCity(city) : [];
    const patch: Partial<AccountFormData> = { city };
    if (states.length === 1) {
      patch.state = states[0];
    } else if (formData.state && states.length > 0 && !states.includes(formData.state)) {
      patch.state = "";
    }
    set(patch);
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>City</Label>
          <Select value={formData.city || "none"} onValueChange={handleCityChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select city" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select —</SelectItem>
              {MAJOR_INDIAN_CITIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>State</Label>
          <Select
            value={formData.state || "none"}
            onValueChange={(v) => set({ state: v === "none" ? "" : v })}
            disabled={!formData.city}
          >
            <SelectTrigger>
              <SelectValue placeholder={formData.city ? "Select state" : "Select city first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select —</SelectItem>
              {stateOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Zone</Label>
          <Select value={formData.zone || "none"} onValueChange={(v) => set({ zone: v === "none" ? "" : v })}>
            <SelectTrigger>
              <SelectValue placeholder="Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select —</SelectItem>
              {["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"].map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Locality / area</Label>
          <Input
            value={formData.locality}
            onChange={(e) => set({ locality: e.target.value })}
            placeholder="e.g. Bandra Kurla Complex"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select value={formData.country} onValueChange={(v) => set({ country: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
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
            onChange={(e) => set({ addressLine1: e.target.value })}
            placeholder="Street / building"
          />
        </div>
        <div className="space-y-1.5">
          <Label>PIN code</Label>
          <Input
            value={formData.zip}
            onChange={(e) => set({ zip: e.target.value })}
            placeholder="6-digit PIN"
          />
        </div>
      </div>
    </div>
  );
}

export function AccountStepCompliance({ ctx }: { ctx: StepContext }) {
  const { formData, set, addSam, removeSam, updateSam, toggleContractingType, updateContractingType } = ctx;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
        <h4 className="text-sm font-medium text-text">Identification</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>GSTIN</Label>
            <Input value={formData.gstin} onChange={(e) => set({ gstin: e.target.value })} placeholder="15-digit GSTIN" />
          </div>
          <div className="space-y-1.5">
            <Label>PAN</Label>
            <Input value={formData.panNumber} onChange={(e) => set({ panNumber: e.target.value })} placeholder="10-digit PAN" />
          </div>
          <div className="space-y-1.5">
            <Label>PMS profile ID</Label>
            <Input
              value={formData.pmsProfileId}
              onChange={(e) => set({ pmsProfileId: e.target.value })}
              placeholder="External system ID"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
        <h4 className="text-sm font-medium text-text">Sales team</h4>
        <div className="space-y-2">
          <Label className="text-sm">Primary account manager (PAM)</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Manager name"
              value={formData.primaryAccountManager?.name || ""}
              onChange={(e) =>
                set({ primaryAccountManager: { ...formData.primaryAccountManager, name: e.target.value } })
              }
            />
            <Input
              placeholder="City"
              value={formData.primaryAccountManager?.city || ""}
              onChange={(e) =>
                set({ primaryAccountManager: { ...formData.primaryAccountManager, city: e.target.value } })
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Secondary managers (SAM)</Label>
            <Button type="button" variant="outline" size="sm" onClick={addSam}>
              Add SAM
            </Button>
          </div>
          {formData.secondaryAccountManagers.map((sam, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <Input placeholder="Name" value={sam.name} onChange={(e) => updateSam(i, { name: e.target.value })} />
              <Input placeholder="City" value={sam.city} onChange={(e) => updateSam(i, { city: e.target.value })} />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeSam(i)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <h4 className="text-sm font-medium text-text">Contracting (optional)</h4>
        {CONTRACTING_TYPE_OPTIONS.map(({ value: type, label }) => {
          const isChecked = formData.contractingTypes.some((t) => t.type === type);
          const entry = formData.contractingTypes.find((t) => t.type === type);
          return (
            <div
              key={type}
              className={cn("border border-border rounded-md p-3 space-y-2", isChecked && "bg-hover/50")}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`ct-${type}`}
                  checked={isChecked}
                  onCheckedChange={(v) => toggleContractingType(type, !!v)}
                />
                <label htmlFor={`ct-${type}`} className="text-sm font-medium cursor-pointer">
                  {label}
                </label>
              </div>
              {isChecked && entry && (
                <div className="space-y-3 pl-6">
                  <p className="text-xs text-text-muted">
                    Period: {formatContractingPeriod(entry)}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-text-muted">From month</Label>
                      <Select
                        value={entry.fromMonth?.toString()}
                        onValueChange={(v) => {
                          const fromMonth = parseInt(v, 10);
                          const fromYear = entry.fromYear ?? new Date().getFullYear();
                          const toMonth = entry.toMonth ?? fromMonth;
                          const patch: Record<string, number> = { fromMonth };
                          if (fromMonth > toMonth && (entry.toYear ?? fromYear) <= fromYear) {
                            patch.toYear = fromYear + 1;
                          }
                          updateContractingType(type, patch);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m) => (
                            <SelectItem key={m.value} value={m.value.toString()}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-text-muted">From year</Label>
                      <Input
                        type="number"
                        min={2000}
                        max={2100}
                        value={entry.fromYear ?? new Date().getFullYear()}
                        onChange={(e) => {
                          const fromYear = parseInt(e.target.value, 10) || new Date().getFullYear();
                          const fromMonth = entry.fromMonth ?? 1;
                          const toMonth = entry.toMonth ?? 12;
                          const patch: Record<string, number> = { fromYear };
                          if (fromMonth > toMonth && (entry.toYear ?? fromYear) <= fromYear) {
                            patch.toYear = fromYear + 1;
                          }
                          updateContractingType(type, patch);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-text-muted">To month</Label>
                      <Select
                        value={entry.toMonth?.toString()}
                        onValueChange={(v) => {
                          const toMonth = parseInt(v, 10);
                          const fromMonth = entry.fromMonth ?? 1;
                          const fromYear = entry.fromYear ?? new Date().getFullYear();
                          const patch: Record<string, number> = { toMonth };
                          if (fromMonth > toMonth && (entry.toYear ?? fromYear) <= fromYear) {
                            patch.toYear = fromYear + 1;
                          }
                          updateContractingType(type, patch);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m) => (
                            <SelectItem key={m.value} value={m.value.toString()}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-text-muted">To year</Label>
                      <Input
                        type="number"
                        min={2000}
                        max={2100}
                        value={entry.toYear ?? entry.fromYear ?? new Date().getFullYear()}
                        onChange={(e) =>
                          updateContractingType(type, {
                            toYear: parseInt(e.target.value, 10) || new Date().getFullYear(),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AccountReviewSummary({
  formData,
  availableAccounts,
}: {
  formData: AccountFormData;
  availableAccounts: Account[];
}) {
  const parent = availableAccounts.find((a) => a.id === formData.parentAccountId);
  const orgLabel =
    ORGANIZATION_TYPES.find((t) => t.value === formData.organizationType)?.label || formData.organizationType;

  return (
    <div className="rounded-lg border border-border bg-hover/40 p-4 space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <span className="text-text-muted">Account name</span>
          <p className="font-medium text-text">{formData.name || "—"}</p>
        </div>
        <div>
          <span className="text-text-muted">Organization</span>
          <p className="font-medium text-text">{orgLabel}</p>
        </div>
        <div>
          <span className="text-text-muted">City</span>
          <p className="font-medium text-text">{formData.city || "—"}</p>
        </div>
        <div>
          <span className="text-text-muted">Parent</span>
          <p className="font-medium text-text">{parent?.name || "Root level"}</p>
        </div>
        <div>
          <span className="text-text-muted">Account type</span>
          <p className="font-medium text-text">{formatAccountTypeLabel(formData.accountType)}</p>
        </div>
        <div>
          <span className="text-text-muted">Properties</span>
          <p className="font-medium text-text">
            {formData.propertyIds.length > 0 ? `${formData.propertyIds.length} selected` : "None"}
          </p>
        </div>
        {formData.contractingTypes.length > 0 && (
          <div className="col-span-2 pt-2 border-t border-border">
            <span className="text-text-muted">Contracting</span>
            <ul className="mt-1 space-y-1">
              {formData.contractingTypes.map((ct) => (
                <li key={ct.type} className="font-medium text-text text-xs">
                  {formatContractingTypeLabel(ct.type)} — {formatContractingPeriod(ct)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
