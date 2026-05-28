import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Calendar, UserCheck, History, TrendingUp, Users, X, Edit, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  assignBuddy,
  getBuddyHistory,
  getActiveBuddyAssignment,
  getAllBuddyAssignments,
  getBuddyReport,
  cancelActiveBuddyAssignment,
  cancelBuddyAssignment,
  updateBuddyAssignment,
  BuddyAssignment,
  ActiveBuddyAssignment,
  BuddyReport,
  UpdateBuddyAssignmentInput,
} from "@/services/buddies";
import { listUsers, User } from "@/services/users";

type ActiveTab = "assign" | "history" | "reports";

interface BuddyManagementProps {
  canAssignBuddy?: boolean;
  canViewHistory?: boolean;
  canViewReports?: boolean;
  backendUserId?: string;
}

export const BuddyManagement = ({
  canAssignBuddy = true,
  canViewHistory = true,
  canViewReports = true,
  backendUserId,
}: BuddyManagementProps) => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedBuddyId, setSelectedBuddyId] = useState<string>("");
  const [effectiveFrom, setEffectiveFrom] = useState<string>("");
  const [effectiveTo, setEffectiveTo] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("assign");
  const [buddyHistory, setBuddyHistory] = useState<BuddyAssignment[]>([]);
  const [allAssignments, setAllAssignments] = useState<BuddyAssignment[]>([]);
  const [reportData, setReportData] = useState<BuddyReport | null>(null);
  const [reportFromDate, setReportFromDate] = useState<string>("");
  const [reportToDate, setReportToDate] = useState<string>("");
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<BuddyAssignment | null>(null);
  const [editEffectiveFrom, setEditEffectiveFrom] = useState<string>("");
  const [editEffectiveTo, setEditEffectiveTo] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    // Set default tab based on available permissions
    if (!canAssignBuddy && !canViewHistory && !canViewReports) {
      return;
    }
    if (activeTab === "assign" && !canAssignBuddy) {
      setActiveTab(canViewHistory ? "history" : "reports");
    } else if (activeTab === "history" && !canViewHistory) {
      setActiveTab(canAssignBuddy ? "assign" : "reports");
    } else if (activeTab === "reports" && !canViewReports) {
      setActiveTab(canAssignBuddy ? "assign" : "history");
    }
  }, [canAssignBuddy, canViewHistory, canViewReports]);

  useEffect(() => {
    if (activeTab === "history") {
      void loadAllAssignments();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const usersData = await listUsers();
      setUsers(usersData.filter((u) => u.status === "ACTIVE"));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load users";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllAssignments = async () => {
    try {
      // Load only current user's assignments
      const assignments = await getBuddyHistory();
      // Filter out cancelled assignments (where effectiveTo < effectiveFrom)
      const activeAssignments = assignments.filter(assignment => !isAssignmentCancelled(assignment));
      setAllAssignments(activeAssignments);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load buddy assignments";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleAssignBuddy = async () => {
    if (!selectedBuddyId || !effectiveFrom) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (effectiveTo && new Date(effectiveTo) < new Date(effectiveFrom)) {
      toast({
        title: "Error",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await assignBuddy({
        buddyUserId: selectedBuddyId,
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
        reason: reason || undefined,
      });

      toast({
        title: "Success",
        description: "Buddy assigned successfully",
      });

      setShowAssignDialog(false);
      setSelectedBuddyId("");
      setEffectiveFrom("");
      setEffectiveTo("");
      setReason("");

      // Refresh history if on history tab
      if (activeTab === "history") {
        void loadAllAssignments();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to assign buddy";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setIsLoading(true);
      const report = await getBuddyReport(
        reportFromDate || undefined,
        reportToDate || undefined
      );
      setReportData(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to generate report";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelActiveAssignments = async () => {
    if (!confirm("Are you sure you want to cancel all active buddy assignments? This action cannot be undone.")) {
      return;
    }

    try {
      setIsCancelling(true);
      const result = await cancelActiveBuddyAssignment();
      toast({
        title: "Success",
        description: result.message,
      });
      void loadAllAssignments();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel assignments";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCancelAssignment = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to cancel this buddy assignment? This action cannot be undone.")) {
      return;
    }

    try {
      setIsCancelling(true);
      const result = await cancelBuddyAssignment(assignmentId);
      toast({
        title: "Success",
        description: result.message,
      });
      void loadAllAssignments();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel assignment";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleEditAssignment = (assignment: BuddyAssignment) => {
    setEditingAssignment(assignment);
    setEditEffectiveFrom(assignment.effectiveFrom.split("T")[0]);
    setEditEffectiveTo(assignment.effectiveTo ? assignment.effectiveTo.split("T")[0] : "");
    setEditReason(assignment.reason || "");
    setShowEditDialog(true);
  };

  const handleUpdateAssignment = async () => {
    if (!editingAssignment) return;

    if (editEffectiveTo && new Date(editEffectiveTo) < new Date(editEffectiveFrom)) {
      toast({
        title: "Error",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const updateData: UpdateBuddyAssignmentInput = {
        effectiveFrom: editEffectiveFrom,
        effectiveTo: editEffectiveTo || null,
        reason: editReason || undefined,
      };

      await updateBuddyAssignment(editingAssignment._id, updateData);
      toast({
        title: "Success",
        description: "Buddy assignment updated successfully",
      });

      setShowEditDialog(false);
      setEditingAssignment(null);
      setEditEffectiveFrom("");
      setEditEffectiveTo("");
      setEditReason("");
      void loadAllAssignments();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update assignment";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isAssignmentCancelled = (assignment: BuddyAssignment): boolean => {
    // An assignment is cancelled if effectiveTo is set and is before effectiveFrom
    if (!assignment.effectiveTo) {
      return false;
    }
    const from = new Date(assignment.effectiveFrom);
    const to = new Date(assignment.effectiveTo);
    return to < from;
  };

  const getAssignmentStatus = (assignment: BuddyAssignment): "scheduled" | "active" | "expired" => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = new Date(assignment.effectiveFrom);
    const to = assignment.effectiveTo ? new Date(assignment.effectiveTo) : null;
    
    // Set hours to 0 for date comparison
    from.setHours(0, 0, 0, 0);
    if (to) {
      to.setHours(0, 0, 0, 0);
    }
    
    if (from > today) {
      return "scheduled"; // Start date is in the future
    }
    
    if (to && to < today) {
      return "expired"; // End date has passed
    }
    
    return "active"; // Currently active
  };

  const isActive = (assignment: BuddyAssignment) => {
    // Exclude cancelled assignments
    if (isAssignmentCancelled(assignment)) {
      return false;
    }
    return getAssignmentStatus(assignment) === "active";
  };

  const activeAssignments = (allAssignments || []).filter(isActive);

  if (isLoading && activeTab === "assign") {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Buddy Management</h1>
        <p className="text-muted-foreground mt-2">
          Assign backup team members to handle leads during unavailability periods
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
        <TabsList>
          {canAssignBuddy && (
            <TabsTrigger value="assign">
              <UserCheck className="mr-2 h-4 w-4" />
              Assign Buddy
            </TabsTrigger>
          )}
          {canViewHistory && (
            <TabsTrigger value="history">
              <History className="mr-2 h-4 w-4" />
              Assignment History
            </TabsTrigger>
          )}
          {canViewReports && (
            <TabsTrigger value="reports">
              <TrendingUp className="mr-2 h-4 w-4" />
              Reports
            </TabsTrigger>
          )}
        </TabsList>

        {canAssignBuddy && (
          <TabsContent value="assign" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assign Buddy</CardTitle>
              <CardDescription>
                Assign a backup team member to handle your leads when you are unavailable
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Buddy Assignment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Assign Buddy</DialogTitle>
                    <DialogDescription>
                      Set up a buddy assignment with date range and reason for unavailability
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="buddy">Buddy (Backup) *</Label>
                      <Select value={selectedBuddyId} onValueChange={setSelectedBuddyId}>
                        <SelectTrigger id="buddy">
                          <SelectValue placeholder="Select buddy" />
                        </SelectTrigger>
                        <SelectContent>
                          {users
                            .filter((u) => u.id !== backendUserId)
                            .map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fromDate">Start Date *</Label>
                        <Input
                          id="fromDate"
                          type="date"
                          value={effectiveFrom}
                          onChange={(e) => setEffectiveFrom(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="toDate">End Date</Label>
                        <Input
                          id="toDate"
                          type="date"
                          value={effectiveTo}
                          onChange={(e) => setEffectiveTo(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reason">Reason for Unavailability</Label>
                      <Textarea
                        id="reason"
                        placeholder="e.g., Leave, Vacation, Training, etc."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setShowAssignDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleAssignBuddy} disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Assigning...
                          </>
                        ) : (
                          "Assign Buddy"
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Active Assignments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Buddy Assignments</CardTitle>
                  <CardDescription>Currently active buddy assignments</CardDescription>
                </div>
                {activeAssignments.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancelActiveAssignments}
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Cancel All Active
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {allAssignments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No active assignments. Create a new assignment to get started.
                </p>
              ) : activeAssignments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No active assignments. Create a new assignment to get started.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Buddy</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAssignments.map((assignment) => (
                      <TableRow key={assignment._id}>
                        <TableCell className="font-medium">
                          {typeof assignment.buddyUserId === "object"
                            ? assignment.buddyUserId.name
                            : "Unknown"}
                        </TableCell>
                        <TableCell>
                          {formatDate(assignment.effectiveFrom)}
                          {assignment.effectiveTo && ` - ${formatDate(assignment.effectiveTo)}`}
                          {!assignment.effectiveTo && " (Ongoing)"}
                        </TableCell>
                        <TableCell>{assignment.reason || "-"}</TableCell>
                        <TableCell>
                          {(() => {
                            const status = getAssignmentStatus(assignment);
                            if (status === "active") {
                              return <Badge variant="default" className="bg-green-500">Active</Badge>;
                            } else if (status === "scheduled") {
                              return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Scheduled</Badge>;
                            } else {
                              return <Badge variant="secondary">Expired</Badge>;
                            }
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditAssignment(assignment)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancelAssignment(assignment._id)}
                              disabled={isCancelling}
                            >
                              <Trash2 className="h-4 w-4" />
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
        </TabsContent>
        )}

        {canViewHistory && (
          <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assignment History</CardTitle>
              <CardDescription>
                Complete history of all buddy assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allAssignments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No assignment history found.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Buddy</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allAssignments.map((assignment) => {
                      const status = getAssignmentStatus(assignment);
                      const canEdit = status === "active" || status === "scheduled";
                      return (
                        <TableRow key={assignment._id}>
                          <TableCell className="font-medium">
                            {typeof assignment.buddyUserId === "object"
                              ? assignment.buddyUserId.name
                              : "Unknown"}
                          </TableCell>
                          <TableCell>{formatDate(assignment.effectiveFrom)}</TableCell>
                          <TableCell>
                            {assignment.effectiveTo
                              ? formatDate(assignment.effectiveTo)
                              : "Ongoing"}
                          </TableCell>
                          <TableCell>{assignment.reason || "-"}</TableCell>
                          <TableCell>
                            {status === "active" ? (
                              <Badge variant="default" className="bg-green-500">Active</Badge>
                            ) : status === "scheduled" ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Scheduled</Badge>
                            ) : (
                              <Badge variant="secondary">Expired</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {canEdit && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditAssignment(assignment)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleCancelAssignment(assignment._id)}
                                    disabled={isCancelling}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {canViewReports && (
          <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Buddy Reports</CardTitle>
              <CardDescription>
                Generate reports on buddy assignments and lead transfers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reportFrom">From Date</Label>
                  <Input
                    id="reportFrom"
                    type="date"
                    value={reportFromDate}
                    onChange={(e) => setReportFromDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reportTo">To Date</Label>
                  <Input
                    id="reportTo"
                    type="date"
                    value={reportToDate}
                    onChange={(e) => setReportToDate(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleGenerateReport} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>

              {reportData && (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Assignments</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{reportData.assignmentsCount}</div>
                        <p className="text-xs text-muted-foreground">Total assignments</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Leads Assigned to Buddies</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{reportData.assignedToBuddies}</div>
                        <p className="text-xs text-muted-foreground">Leads redirected</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Leads Received as Buddy</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{reportData.receivedAsBuddy}</div>
                        <p className="text-xs text-muted-foreground">Leads received</p>
                      </CardContent>
                    </Card>
                  </div>

                  {reportData.assignments.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Assignment Details</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Buddy</TableHead>
                              <TableHead>Start Date</TableHead>
                              <TableHead>End Date</TableHead>
                              <TableHead>Reason</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reportData.assignments.map((assignment, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{assignment.buddyUserId}</TableCell>
                                <TableCell>{formatDate(assignment.effectiveFrom)}</TableCell>
                                <TableCell>
                                  {assignment.effectiveTo
                                    ? formatDate(assignment.effectiveTo)
                                    : "Ongoing"}
                                </TableCell>
                                <TableCell>{assignment.reason || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>

      {/* Edit Assignment Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Buddy Assignment</DialogTitle>
            <DialogDescription>
              Update the date range or reason for this buddy assignment
            </DialogDescription>
          </DialogHeader>
          {editingAssignment && (
            <div className="space-y-4 mt-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">Buddy:</p>
                <p className="text-sm text-muted-foreground">
                  {typeof editingAssignment.buddyUserId === "object"
                    ? editingAssignment.buddyUserId.name
                    : "Unknown"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editFromDate">Start Date *</Label>
                  <Input
                    id="editFromDate"
                    type="date"
                    value={editEffectiveFrom}
                    onChange={(e) => setEditEffectiveFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editToDate">End Date</Label>
                  <Input
                    id="editToDate"
                    type="date"
                    value={editEffectiveTo}
                    onChange={(e) => setEditEffectiveTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editReason">Reason for Unavailability</Label>
                <Textarea
                  id="editReason"
                  placeholder="e.g., Leave, Vacation, Training, etc."
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingAssignment(null);
                    setEditEffectiveFrom("");
                    setEditEffectiveTo("");
                    setEditReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdateAssignment} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Assignment"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

