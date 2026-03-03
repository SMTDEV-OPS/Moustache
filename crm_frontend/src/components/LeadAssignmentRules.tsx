import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit, GitBranch, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  listAssignmentRules,
  createAssignmentRule,
  updateAssignmentRule,
  deleteAssignmentRule,
  AssignmentRule,
  EmployeeGroup,
} from "@/services/assignmentRules";
import { listGroups, Group } from "@/services/groups";

// Lead types from backend
const LEAD_TYPES = [
  { value: "STAY", label: "Stay" },
  { value: "DINING", label: "Dining" },
  { value: "INFORMATION", label: "Information" },
  { value: "MICE", label: "MICE" },
  { value: "WEDDING", label: "Wedding" },
];

export function LeadAssignmentRules() {
  const { toast } = useToast();
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);
  const [selectedLeadType, setSelectedLeadType] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [rulesData, groupsData] = await Promise.all([
        listAssignmentRules(),
        listGroups(),
      ]);
      setRules(rulesData);
      setGroups(groupsData.filter((g) => g.isActive));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load data";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    setSelectedLeadType("");
    setSelectedGroupId("");
    setIsActive(true);
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: AssignmentRule) => {
    setEditingRule(rule);
    setSelectedLeadType(rule.leadType);
    setSelectedGroupId(
      typeof rule.employeeGroupId === "string"
        ? rule.employeeGroupId
        : (rule.employeeGroupId as EmployeeGroup)._id
    );
    setIsActive(rule.isActive);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedLeadType || !selectedGroupId) {
      toast({
        title: "Error",
        description: "Please select both lead type and employee group",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingRule) {
        await updateAssignmentRule(editingRule.id, {
          employeeGroupId: selectedGroupId,
          isActive,
        });
        toast({
          title: "Success",
          description: "Assignment rule updated successfully",
        });
      } else {
        await createAssignmentRule({
          leadType: selectedLeadType,
          employeeGroupId: selectedGroupId,
          isActive,
        });
        toast({
          title: "Success",
          description: "Assignment rule created successfully",
        });
      }

      setIsDialogOpen(false);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save rule";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAssignmentRule(id);
      toast({
        title: "Success",
        description: "Assignment rule deleted successfully",
      });
      setDeleteConfirmId(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete rule";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const toggleRuleStatus = async (rule: AssignmentRule) => {
    try {
      await updateAssignmentRule(rule.id, {
        isActive: !rule.isActive,
      });
      toast({
        title: "Success",
        description: `Rule ${rule.isActive ? "disabled" : "enabled"} successfully`,
      });
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update rule";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const getGroupName = (groupId: string | EmployeeGroup): string => {
    if (typeof groupId === "object") {
      return groupId.name;
    }
    const group = groups.find((g) => g.id === groupId);
    return group?.name ?? "Unknown Group";
  };

  const getLeadTypeLabel = (value: string): string => {
    return LEAD_TYPES.find((t) => t.value === value)?.label ?? value;
  };

  // Get lead types that don't have rules yet (for create mode)
  const availableLeadTypes = LEAD_TYPES.filter(
    (type) => !rules.some((rule) => rule.leadType === type.value)
  );

  if (isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Loading assignment rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Lead Assignment Rules</h2>
          <p className="text-muted-foreground">
            Configure how leads are automatically assigned to employee groups based on lead type.
          </p>
        </div>
        <Button onClick={openCreateDialog} disabled={availableLeadTypes.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      {availableLeadTypes.length === 0 && rules.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            All lead types have been configured. Edit existing rules to modify assignments.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Assignment Rules
          </CardTitle>
          <CardDescription>
            When a lead is created, it will be automatically assigned to a user from the mapped
            employee group. The user with the least open leads who is currently online will be
            selected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <GitBranch className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">
                No assignment rules configured yet. Create your first rule to enable automatic lead
                assignment.
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Rule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Type</TableHead>
                  <TableHead>Employee Group</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-medium">
                        {getLeadTypeLabel(rule.leadType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {getGroupName(rule.employeeGroupId)}
                        </span>
                        {typeof rule.employeeGroupId === "object" &&
                          rule.employeeGroupId.teamType && (
                            <span className="text-xs text-muted-foreground">                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => void toggleRuleStatus(rule)}
                        />
                        <span
                          className={
                            rule.isActive ? "text-green-600" : "text-muted-foreground"
                          }
                        >
                          {rule.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(rule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmId(rule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Assignment Rule" : "Create Assignment Rule"}
            </DialogTitle>
            <DialogDescription>
              {editingRule
                ? "Update the employee group for this lead type."
                : "Map a lead type to an employee group for automatic assignment."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lead-type">Lead Type</Label>
              <Select
                value={selectedLeadType}
                onValueChange={setSelectedLeadType}
                disabled={!!editingRule}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select lead type" />
                </SelectTrigger>
                <SelectContent>
                  {(editingRule ? LEAD_TYPES : availableLeadTypes).map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee-group">Employee Group</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <div className="flex flex-col">
                        <span>{group.name}</span>                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is-active">Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Assignment Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this assignment rule? Leads of this type will no
              longer be automatically assigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && void handleDelete(deleteConfirmId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LeadAssignmentRules;

