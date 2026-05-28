import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Pencil, Plus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getLeadContactInfo, listLeads, type Lead } from "@/services/leads";
import { FieldSalesLeadWizard } from "@/components/leads/fieldSales/FieldSalesLeadWizard";

interface AccountLeadsProps {
  accountId: string;
  accountName?: string;
  isSystemAdmin?: boolean;
}

function getLeadAccountId(lead: Lead): string | undefined {
  if (!lead.accountId) return undefined;
  if (typeof lead.accountId === "string") return lead.accountId;
  return lead.accountId.id || lead.accountId._id;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function getStatusBadgeClass(status?: string) {
  const key = (status || "").toUpperCase();
  if (key === "NEW") return "bg-blue-100 text-blue-800 border-blue-200";
  if (key === "CONTACTED") return "bg-amber-100 text-amber-800 border-amber-200";
  if (key === "QUALIFIED") return "bg-indigo-100 text-indigo-800 border-indigo-200";
  if (key === "CONVERTED") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (key === "CLOSED" || key === "LOST") return "bg-red-100 text-red-800 border-red-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getHeatBadgeClass(heat?: string) {
  const key = (heat || "").toUpperCase();
  if (key === "HOT") return "bg-red-100 text-red-800 border-red-200";
  if (key === "WARM") return "bg-amber-100 text-amber-800 border-amber-200";
  if (key === "COLD") return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function AccountLeads({ accountId, accountName: accountNameProp }: AccountLeadsProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [editLeadId, setEditLeadId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const accountName = accountNameProp || "";

  const accountLeads = useMemo(
    () => leads.filter((lead) => getLeadAccountId(lead) === accountId),
    [leads, accountId]
  );

  const loadLeads = async () => {
    try {
      setLoading(true);
      const data = await listLeads({ scope: "all" });
      setLeads(data);
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLeads();
  }, [accountId]);


  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => { setEditLeadId(null); setIsAddLeadOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add lead
        </Button>
        <FieldSalesLeadWizard
          open={isAddLeadOpen}
          onOpenChange={setIsAddLeadOpen}
          defaultAccountId={accountId}
          defaultAccountName={accountName}
          editLeadId={editLeadId}
          onSuccess={() => void loadLeads()}
        />
      </div>

      {accountLeads.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p>No leads yet for this account.</p>
            <Button variant="outline" className="mt-4" onClick={() => setIsAddLeadOpen(true)}>
              Add lead
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead number</TableHead>
                <TableHead>Guest / contact</TableHead>
                <TableHead>Lead type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Heat level</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created at</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountLeads.map((lead) => {
                const contact = getLeadContactInfo(lead);
                return (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <TableCell className="font-medium">{lead.leadNumber || "—"}</TableCell>
                    <TableCell>{contact.name || "—"}</TableCell>
                    <TableCell>{lead.leadType || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusBadgeClass(lead.status)}>
                        {lead.status || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getHeatBadgeClass(lead.heatLevel)}>
                        {lead.heatLevel || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>{lead.source || "—"}</TableCell>
                    <TableCell>{formatDate(lead.createdAt)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditLeadId(lead.id);
                          setIsAddLeadOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
