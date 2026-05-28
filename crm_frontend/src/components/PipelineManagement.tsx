import React, { useState, useEffect } from "react";
import {
    Plus,
    Trash2,
    GripVertical,
    Settings2,
    Check,
    ChevronRight,
    AlertCircle,
    Save,
    Loader2
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
import { PipelineService, Pipeline, PipelineStage } from "@/services/pipelines";

export function PipelineManagement() {
    const { toast } = useToast();
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingStages, setEditingStages] = useState<Partial<PipelineStage>[]>([]);

    useEffect(() => {
        loadPipelines();
    }, []);

    const loadPipelines = async () => {
        try {
            setIsLoading(true);
            const data = await PipelineService.getModulePipelines("leads");
            setPipelines(data);
            if (data.length > 0 && !selectedPipeline) {
                handleSelectPipeline(data[0]);
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load pipelines",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectPipeline = (pipeline: Pipeline) => {
        setSelectedPipeline(pipeline);
        const stages = Array.isArray(pipeline.stages) ? pipeline.stages : [];
        setEditingStages([...stages].sort((a, b) => a.order - b.order));
    };

    const handleAddStage = () => {
        const newStage: Partial<PipelineStage> = {
            name: "New Stage",
            order: editingStages.length,
            isTerminal: false,
            color: "#3b82f6", // Default blue
            probability: 0
        };
        setEditingStages([...editingStages, newStage]);
    };

    const handleRemoveStage = (index: number) => {
        const newStages = [...editingStages];
        newStages.splice(index, 1);
        // Reorder
        const reordered = newStages.map((s, i) => ({ ...s, order: i }));
        setEditingStages(reordered);
    };

    const handleUpdateStage = (index: number, updates: Partial<PipelineStage>) => {
        const newStages = [...editingStages];
        newStages[index] = { ...newStages[index], ...updates };
        setEditingStages(newStages);
    };

    const handleMoveStage = (index: number, direction: "up" | "down") => {
        if (direction === "up" && index === 0) return;
        if (direction === "down" && index === editingStages.length - 1) return;

        const newStages = [...editingStages];
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];

        // Update orders
        const reordered = newStages.map((s, i) => ({ ...s, order: i }));
        setEditingStages(reordered);
    };

    const handleSaveStages = async () => {
        if (!selectedPipeline) return;

        try {
            setIsSaving(true);
            await PipelineService.updateStages(selectedPipeline._id, editingStages);
            toast({
                title: "Success",
                description: "Pipeline stages updated successfully",
            });
            await loadPipelines(); // Refresh
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save pipeline stages",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
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
                    <h1 className="text-2xl font-bold tracking-tight">Pipeline Management</h1>
                    <p className="text-muted-foreground">Define and organize your sales stages.</p>
                </div>
                <Button onClick={() => { /* TODO: Create Pipeline Dialog */ }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Pipeline
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Pipeline List */}
                <div className="md:col-span-1 space-y-3">
                    <Label className="text-sm font-semibold text-muted-foreground uppercase px-1">Active Pipelines</Label>
                    {pipelines.map((p) => (
                        <Card
                            key={p._id}
                            className={`cursor-pointer transition-all hover:border-primary/50 ${selectedPipeline?._id === p._id ? "border-primary bg-primary/5 shadow-sm" : ""}`}
                            onClick={() => handleSelectPipeline(p)}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="font-medium text-sm">{p.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {(Array.isArray(p.stages) ? p.stages.length : 0)} stages
                                    </span>
                                </div>
                                {p.isDefault && <Badge variant="outline" className="text-[10px] h-4">Default</Badge>}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Stage Editor */}
                <div className="md:col-span-3">
                    {selectedPipeline ? (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>{selectedPipeline.name}</CardTitle>
                                    <CardDescription>{selectedPipeline.description || "Configure stages for this pipeline."}</CardDescription>
                                </div>
                                <Button onClick={handleSaveStages} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    Save Changes
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-md border p-1 bg-muted/30">
                                    {editingStages.length === 0 && (
                                        <div className="p-8 text-center">
                                            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                            <p className="text-sm text-muted-foreground">No stages defined for this pipeline.</p>
                                            <Button variant="outline" size="sm" className="mt-4" onClick={handleAddStage}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Add First Stage
                                            </Button>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        {editingStages.map((stage, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center gap-3 p-3 bg-card border rounded-md group animate-in slide-in-from-left-2 duration-200"
                                            >
                                                <div className="flex flex-col gap-1 items-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => handleMoveStage(index, "up")}
                                                        disabled={index === 0}
                                                    >
                                                        <ChevronRight className="h-4 w-4 -rotate-90" />
                                                    </Button>
                                                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => handleMoveStage(index, "down")}
                                                        disabled={index === editingStages.length - 1}
                                                    >
                                                        <ChevronRight className="h-4 w-4 rotate-90" />
                                                    </Button>
                                                </div>

                                                <div className="flex-1 grid grid-cols-12 gap-3 items-center">
                                                    <div className="col-span-4">
                                                        <Input
                                                            placeholder="Stage Name"
                                                            value={stage.name}
                                                            onChange={(e) => handleUpdateStage(index, { name: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="col-span-3">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="color"
                                                                value={stage.color || "#3b82f6"}
                                                                onChange={(e) => handleUpdateStage(index, { color: e.target.value })}
                                                                className="h-8 w-8 rounded cursor-pointer border-none bg-transparent"
                                                            />
                                                            <Input
                                                                placeholder="Color Hex"
                                                                value={stage.color}
                                                                className="text-xs h-8"
                                                                onChange={(e) => handleUpdateStage(index, { color: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <div className="relative">
                                                            <Input
                                                                type="number"
                                                                placeholder="Prob %"
                                                                value={stage.probability}
                                                                className="pr-6 h-8"
                                                                onChange={(e) => handleUpdateStage(index, { probability: parseInt(e.target.value) })}
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <Select
                                                            value={stage.isTerminal ? (stage.terminalType || "NONE") : "NONE"}
                                                            onValueChange={(val) => {
                                                                if (val === "NONE") {
                                                                    handleUpdateStage(index, { isTerminal: false, terminalType: undefined });
                                                                } else {
                                                                    handleUpdateStage(index, { isTerminal: true, terminalType: val as "WON" | "LOST" });
                                                                }
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue placeholder="Standard" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="NONE" className="text-xs">Standard</SelectItem>
                                                                <SelectItem value="WON" className="text-xs">Won (Closed)</SelectItem>
                                                                <SelectItem value="LOST" className="text-xs">Lost (Closed)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="col-span-1 flex justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                                                            onClick={() => handleRemoveStage(index)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full mt-2 text-muted-foreground border-dashed border hover:bg-muted/50"
                                        onClick={handleAddStage}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Append Stage
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="flex h-full items-center justify-center rounded-md border border-dashed p-12 text-center">
                            <div className="space-y-1">
                                <Settings2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-4" />
                                <h3 className="font-semibold text-lg">No Pipeline Selected</h3>
                                <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">Select a pipeline from the list to manage its stages or create a new one.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
