import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { listApprovals, approveRequest, rejectRequest, ApprovalRequest } from "@/services/approvals";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const AccountApprovals = () => {
    const { toast } = useToast();
    const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
    const [rejectNotes, setRejectNotes] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        loadApprovals();
    }, []);

    const loadApprovals = async () => {
        try {
            setIsLoading(true);
            const data = await listApprovals("PENDING");
            setApprovals(data || []);
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.message || "Failed to load approval requests",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (id: string) => {
        if (!confirm("Are you sure you want to approve this duplicate request and create the account?")) return;
        try {
            setIsProcessing(true);
            await approveRequest(id);
            toast({ title: "Success", description: "Request approved and account created." });
            loadApprovals();
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Error approving request", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!rejectDialogId) return;
        try {
            setIsProcessing(true);
            await rejectRequest(rejectDialogId, rejectNotes);
            toast({ title: "Success", description: "Request rejected." });
            setRejectDialogId(null);
            setRejectNotes("");
            loadApprovals();
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Error rejecting request", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p>Loading approval requests...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Duplicate Approvals</h1>
                    <p className="text-muted-foreground mt-1">Review and manage pending account creations flagged as duplicates.</p>
                </div>
            </div>

            {approvals.length === 0 ? (
                <Card className="border-dashed shadow-sm bg-muted/50">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <CheckCircle className="h-12 w-12 text-emerald-500/50 mb-4" />
                        <p className="text-base font-medium text-foreground mb-1">You're all caught up!</p>
                        <p className="text-sm text-muted-foreground">There are no pending duplicate approvals at the moment.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {approvals.map((req) => (
                        <Card key={req._id} className="border-slate-200 shadow-sm">
                            <CardHeader className="border-b border-border bg-muted/50 pb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            {req.entityName}
                                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                                {req.entityType}
                                            </Badge>
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Submitted on {format(new Date(req.createdAt), "PPP p")}
                                            {req.submittedBy && ` by ${req.submittedBy.firstName} ${req.submittedBy.lastName}`}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                            onClick={() => setRejectDialogId(req._id)}
                                            disabled={isProcessing}
                                        >
                                            <XCircle className="w-4 h-4 mr-1" /> Reject
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                            onClick={() => handleApprove(req._id)}
                                            disabled={isProcessing}
                                        >
                                            <CheckCircle className="w-4 h-4 mr-1" /> Approve & Create
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 bg-background">
                                <div className="text-sm">
                                    <h4 className="font-semibold mb-2 text-muted-foreground">Payload Overview:</h4>
                                    <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs text-slate-700 border border-border">
                                        {JSON.stringify(req.payload, null, 2)}
                                    </pre>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Reject Dialog */}
            <Dialog open={!!rejectDialogId} onOpenChange={(open) => !open && setRejectDialogId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Duplicate</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-muted-foreground mb-4">You are about to reject this creation request. Please provide a reason to the user.</p>
                        <Textarea
                            placeholder="Enter rejection notes (e.g., Please link to the existing account instead)..."
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                            className="min-h-[100px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialogId(null)} disabled={isProcessing}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={isProcessing}>
                            {isProcessing ? "Processing..." : "Confirm Rejection"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
