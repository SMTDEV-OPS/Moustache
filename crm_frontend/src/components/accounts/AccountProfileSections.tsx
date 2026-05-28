import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatAccountTypeLabel } from "./accountFormTypes";
import type { Account } from "@/services/accounts";
import { getFieldStyle } from "@/utils/fieldStyling";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ProfileSection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ProfileField({
  label,
  value,
  synced,
  className,
}: {
  label: string;
  value: ReactNode;
  synced?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <span className="text-xs text-text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium text-text">{value}</div>
        {synced && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px]">
                  System
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Synced from PMS. Manual edits override system data.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

function orgTypeLabel(type?: string) {
  if (!type) return "—";
  return type
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function AccountProfileCompany({ account }: { account: Account }) {
  return (
    <ProfileSection title="Company">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ProfileField label="Legal name" value={account.name} />
        <ProfileField label="Organization type" value={orgTypeLabel(account.organizationType)} />
        <ProfileField label="Industry" value={account.industry || "Not specified"} />
        <ProfileField
          label="Industry size"
          value={
            <Badge variant="secondary" className="font-normal">
              {account.industryStatus || "Medium"}
            </Badge>
          }
        />
        {account.industrySubCategory && (
          <ProfileField label="Sub-category" value={account.industrySubCategory} className="sm:col-span-2" />
        )}
      </div>
    </ProfileSection>
  );
}

export function AccountProfileLocation({ account }: { account: Account }) {
  const addressFields = ["addressLine1", "addressLine2", "city", "state", "country", "zip"];
  const isSynced = addressFields.some((f) => account.systemSyncedFields?.includes(f));

  return (
    <ProfileSection title="Location">
      <ProfileField
        label="Address"
        synced={isSynced}
        value={
          <span className="leading-relaxed">
            {account.locality && `${account.locality}, `}
            {[account.city, account.state].filter(Boolean).join(", ") || "—"}
            <br />
            {[account.country, account.zip].filter(Boolean).join(" · ")}
          </span>
        }
      />
      {(account.email || account.website) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
          {account.email && <ProfileField label="Email" value={account.email} />}
          {account.website && <ProfileField label="Website" value={account.website} />}
        </div>
      )}
    </ProfileSection>
  );
}

export function AccountProfileCommercial({ account }: { account: Account }) {
  return (
    <ProfileSection title="Commercial">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ProfileField label="Account type" value={formatAccountTypeLabel(account.accountType)} />
        <ProfileField label="Account level" value={account.accountLevel?.replace(/_/g, " ") || "—"} />
        <ProfileField label="Zone" value={account.zone || "—"} />
        <ProfileField
          label="Status"
          value={
            <Badge variant="outline" className="font-normal capitalize">
              {(account.status || "active").toLowerCase()}
            </Badge>
          }
        />
      </div>
    </ProfileSection>
  );
}

export function AccountProfileCompliance({
  account,
  syncAction,
}: {
  account: Account;
  syncAction?: ReactNode;
}) {
  return (
    <ProfileSection title="Compliance" action={syncAction}>
      <div className="space-y-3">
        <div className="flex justify-between items-center gap-2">
          <span className="text-sm text-text-muted">GSTIN</span>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-mono font-medium",
                getFieldStyle("gstin", account.systemSyncedFields)
              )}
            >
              {account.gstin || "N/A"}
            </span>
            {account.systemSyncedFields?.includes("gstin") && (
              <Badge variant="outline" className="text-[10px]">
                System
              </Badge>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-sm text-text-muted">PAN</span>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-mono font-medium",
                getFieldStyle("panNumber", account.systemSyncedFields)
              )}
            >
              {account.panNumber || "N/A"}
            </span>
            {account.systemSyncedFields?.includes("panNumber") && (
              <Badge variant="outline" className="text-[10px]">
                System
              </Badge>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-sm text-text-muted">PMS profile ID</span>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium",
                getFieldStyle("pmsProfileId", account.systemSyncedFields)
              )}
            >
              {account.pmsProfileId || "Not linked"}
            </span>
            {account.systemSyncedFields?.includes("pmsProfileId") && (
              <Badge variant="outline" className="text-[10px]">
                System
              </Badge>
            )}
          </div>
        </div>
      </div>
    </ProfileSection>
  );
}

export function AccountProfileSales({ account }: { account: Account }) {
  return (
    <ProfileSection title="Sales team">
      <div className="space-y-3">
        <ProfileField
          label="Primary account manager"
          value={
            <>
              {account.primaryAccountManager?.name || "Unassigned"}
              {account.primaryAccountManager?.city && (
                <span className="text-text-muted font-normal"> · {account.primaryAccountManager.city}</span>
              )}
            </>
          }
        />
        {account.secondaryAccountManagers && account.secondaryAccountManagers.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-text-muted">Secondary managers</span>
            <ul className="text-sm space-y-1">
              {account.secondaryAccountManagers.map((sam, i) => (
                <li key={i} className="font-medium text-text">
                  {sam.name}
                  {sam.city ? ` (${sam.city})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ProfileSection>
  );
}
