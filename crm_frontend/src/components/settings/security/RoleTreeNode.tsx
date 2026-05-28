import { useState } from "react";
import { ChevronRight, ChevronDown, User, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleTreeItem {
    _id: string;
    name: string;
    description?: string;
    parentRoleId?: string;
    shareDataWithPeers: boolean;
    isSystemRole?: boolean;
    children: RoleTreeItem[];
    userCount?: number;
}

interface RoleTreeNodeProps {
    node: RoleTreeItem;
    level?: number;
    selectedRoleId: string | null;
    onSelect: (role: RoleTreeItem) => void;
    isExpandedAll: boolean;
}

export function RoleTreeNode({ node, level = 0, selectedRoleId, onSelect, isExpandedAll }: RoleTreeNodeProps) {
    const [isExpanded, setIsExpanded] = useState(isExpandedAll);

    // Sync with prop changes
    useState(() => {
        setIsExpanded(isExpandedAll);
    });

    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedRoleId === node._id;

    return (
        <div className="select-none relative">
            {/* Horizontal connecting line to this node (except for root level 0) */}
            {level > 0 && (
                <div
                    className="absolute border-b border-dashed border-gray-400"
                    style={{
                        left: `${(level - 1) * 32 + 12}px`,
                        top: '16px',
                        width: '20px'
                    }}
                />
            )}

            <div
                className={cn(
                    "flex items-center py-1 cursor-pointer transition-colors relative z-10 w-max",
                )}
                style={{ marginLeft: `${level * 32}px` }}
                onClick={() => onSelect(node)}
            >
                {/* Node Expansion Box (Zoho Style [-] / [+]) */}
                <div
                    className={cn(
                        "w-5 h-5 flex items-center justify-center mr-2 border rounded-sm text-xs text-gray-600 bg-white hover:border-gray-400",
                        isSelected && "border-blue-400 bg-blue-50"
                    )}
                    onClick={(e) => {
                        if (hasChildren) {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }
                    }}
                >
                    {hasChildren ? (
                        isExpanded ? "-" : "+"
                    ) : (
                        <span className="opacity-0">-</span> // Hidden placeholder for leaf nodes to align text
                    )}
                </div>

                {/* Node Text */}
                <span className={cn(
                    "text-sm",
                    isSelected ? "font-semibold text-blue-700" : "text-gray-700 hover:text-blue-600"
                )}>
                    {node.name}
                </span>
            </div>

            {/* Render Children */}
            {hasChildren && isExpanded && (
                <div className="relative">
                    {/* Vertical Tree Line Connector extending down from CURRENT node to last child */}
                    <div
                        className="absolute border-l border-dashed border-gray-400"
                        style={{
                            left: `${level * 32 + 10}px`,
                            top: '-8px',
                            bottom: '16px', // Stop at the last child's horizontal line
                        }}
                    />

                    <div>
                        {node.children.map((child) => (
                            <RoleTreeNode
                                key={child._id}
                                node={child}
                                level={level + 1}
                                selectedRoleId={selectedRoleId}
                                onSelect={onSelect}
                                isExpandedAll={isExpandedAll}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
