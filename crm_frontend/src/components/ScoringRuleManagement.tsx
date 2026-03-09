import React, { useState, useEffect } from "react";
import {
    Plus,
    Trash2,
    Settings2,
    AlertCircle,
    Save,
    Loader2,
    ChevronRight,
    GripVertical
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ScoringService, ScoringRule, ScoringCondition } from "@/services/scoringRules";

export function ScoringRuleManagement() {
    const { toast } = useToast();
    const [rules, setRules] = useState<ScoringRule[]>([]);
    const [selectedRule, setSelectedRule] = useState<ScoringRule | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = async () => {
        try {
            setIsLoading(true);
            const data = await ScoringService.getRules("leads");
            setRules(data);
            if (data.length > 0 && !selectedRule) {
                setSelectedRule(data[0]);
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load scoring rules",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateRule = () => {
        const newRule: Partial<ScoringRule> = {
            name: "New Scoring Rule",
            module: "leads",
            isActive: true,
            priority: rules.length > 0 ? Math.max(...rules.map(r => r.priority)) + 10 : 10,
            conditionLogic: "AND",
            conditions: [{ field: "source", operator: "is", value: "" }],
            points: 1
        };

        // In a real app, you'd open a dialog or immediately POST.
        // Here we'll just mock the selection of a new rule state.
        setSelectedRule(newRule as ScoringRule);
    };

    const handleSaveRule = async () => {
        if (!selectedRule) return;

        try {
            setIsSaving(true);
            if (selectedRule._id) {
                await ScoringService.updateRule(selectedRule._id, selectedRule);
            } else {
                await ScoringService.createRule(selectedRule);
            }
            toast({
                title: "Success",
                description: "Scoring rule saved successfully",
            });
            await loadRules();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save scoring rule",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRule = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this rule?")) return;
        try {
            await ScoringService.deleteRule(id);
            toast({
                title: "Deleted",
                description: "Scoring rule removed",
            });
            if (selectedRule?._id === id) setSelectedRule(null);
            await loadRules();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete rule",
                variant: "destructive",
            });
        }
    };

    const handleAddCondition = () => {
        if (!selectedRule) return;
        const newConditions = [...selectedRule.conditions, { field: "", operator: "is" as any, value: "" }];
        setSelectedRule({ ...selectedRule, conditions: newConditions });
    };

    const handleRemoveCondition = (index: number) => {
        if (!selectedRule) return;
        const newConditions = [...selectedRule.conditions];
        newConditions.splice(index, 1);
        setSelectedRule({ ...selectedRule, conditions: newConditions });
    };

    const handleUpdateCondition = (index: number, updates: Partial<ScoringCondition>) => {
        if (!selectedRule) return;
        const newConditions = [...selectedRule.conditions];
        newConditions[index] = { ...newConditions[index], ...updates };
        setSelectedRule({ ...selectedRule, conditions: newConditions });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Lead Scoring Rules</h1>
                    <p className="text-muted-foreground">Define criteria to automatically calculate lead quality scores (0-10).</p>
                </div>
                <Button onClick={handleCreateRule}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Rule
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Rule List */}
                <div className="md:col-span-1 space-y-3">
                    <Label className="text-sm font-semibold text-muted-foreground uppercase px-1">Active Rules</Label>
                    <div className="space-y-2">
                        {rules.map((rule) => (
                            <Card
                                key={rule._id}
                                className={`cursor-pointer transition-all hover:border-primary/50 ${selectedRule?._id === rule._id ? "border-primary bg-primary/5 shadow-sm" : ""}`}
                                onClick={() => setSelectedRule(rule)}
                            >
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="font-medium text-xs truncate">{rule.name}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant={rule.points > 0 ? "default" : "destructive"} className="text-[9px] h-3 px-1">
                                                {rule.points > 0 ? `+${rule.points}` : rule.points} pts
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground">Pri: {rule.priority}</span>
                                        </div>
                                    </div>
                                    {!rule.isActive && <Badge variant="outline" className="text-[9px] h-3 opacity-50">Inactive</Badge>}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Rule Editor */}
                <div className="md:col-span-3">
                    {selectedRule ? (
                        <Card className="border-primary/20 shadow-lg">
                            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg">Edit Scoring Rule</CardTitle>
                                    <CardDescription>Rules are evaluated in order of priority.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    {selectedRule._id && (
                                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteRule(selectedRule._id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button onClick={handleSaveRule} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        Save Rule
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                {/* Basic Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Rule Name</Label>
                                        <Input
                                            value={selectedRule.name}
                                            onChange={(e) => setSelectedRule({ ...selectedRule, name: e.target.value })}
                                            placeholder="e.g. High Budget Lead"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Description</Label>
                                        <Input
                                            value={selectedRule.description || ""}
                                            onChange={(e) => setSelectedRule({ ...selectedRule, description: e.target.value })}
                                            placeholder="What does this rule identify?"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Points</Label>
                                            <Input
                                                type="number"
                                                value={selectedRule.points}
                                                onChange={(e) => setSelectedRule({ ...selectedRule, points: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Priority</Label>
                                            <Input
                                                type="number"
                                                value={selectedRule.priority}
                                                onChange={(e) => setSelectedRule({ ...selectedRule, priority: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 border rounded-md">
                                        <div className="space-y-0.5">
                                            <Label>Active Status</Label>
                                            <p className="text-[10px] text-muted-foreground">Enable this rule for evaluation.</p>
                                        </div>
                                        <Switch
                                            checked={selectedRule.isActive}
                                            onCheckedChange={(val) => setSelectedRule({ ...selectedRule, isActive: val })}
                                        />
                                    </div>
                                </div>

                                {/* Conditions */}
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-base font-semibold">Conditions</Label>
                                            <Select
                                                value={selectedRule.conditionLogic}
                                                onValueChange={(val: "AND" | "OR") => setSelectedRule({ ...selectedRule, conditionLogic: val })}
                                            >
                                                <SelectTrigger className="h-7 w-20 text-[10px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="AND">AND</SelectItem>
                                                    <SelectItem value="OR">OR</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={handleAddCondition}>
                                            <Plus className="h-3 w-3 mr-1" />
                                            Add Condition
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        {selectedRule.conditions.map((cond, idx) => (
                                            <div key={idx} className="flex items-center gap-2 animate-in slide-in-from-top-1">
                                                <div className="flex-1 grid grid-cols-12 gap-2">
                                                    <Select
                                                        value={cond.field}
                                                        onValueChange={(val) => handleUpdateCondition(idx, { field: val })}
                                                    >
                                                        <SelectTrigger className="col-span-4 h-9 text-xs">
                                                            <SelectValue placeholder="Field" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="source">Source</SelectItem>
                                                            <SelectItem value="budget">Budget</SelectItem>
                                                            <SelectItem value="estimatedValue">Deal Value</SelectItem>
                                                            <SelectItem value="customerType">Customer Type</SelectItem>
                                                            <SelectItem value="bookingWindow">Booking Window</SelectItem>
                                                            <SelectItem value="_daysUntil_checkInDate">Days until Check-in</SelectItem>
                                                            <SelectItem value="contactDetails.phone">Phone Number</SelectItem>
                                                            <SelectItem value="contactDetails.email">Email Address</SelectItem>
                                                        </SelectContent>
                                                    </Select>

                                                    <Select
                                                        value={cond.operator}
                                                        onValueChange={(val: any) => handleUpdateCondition(idx, { operator: val })}
                                                    >
                                                        <SelectTrigger className="col-span-3 h-9 text-xs">
                                                            <SelectValue placeholder="Operator" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="is">is</SelectItem>
                                                            <SelectItem value="is_not">is not</SelectItem>
                                                            <SelectItem value="contains">contains</SelectItem>
                                                            <SelectItem value="greater_than">&gt;</SelectItem>
                                                            <SelectItem value="less_than">&lt;</SelectItem>
                                                            <SelectItem value="is_empty">is empty</SelectItem>
                                                            <SelectItem value="is_not_empty">is not empty</SelectItem>
                                                        </SelectContent>
                                                    </Select>

                                                    <Input
                                                        className="col-span-5 h-9 text-xs"
                                                        placeholder="Value"
                                                        value={cond.value}
                                                        disabled={cond.operator === "is_empty" || cond.operator === "is_not_empty"}
                                                        onChange={(e) => handleUpdateCondition(idx, { value: e.target.value })}
                                                    />
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleRemoveCondition(idx)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="flex h-full items-center justify-center rounded-md border border-dashed p-12 text-center">
                            <div className="space-y-1">
                                <Settings2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-4" />
                                <h3 className="font-semibold text-lg">No Rule Selected</h3>
                                <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">Select a scoring rule to edit or create a new one to automate lead quality assessment.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
