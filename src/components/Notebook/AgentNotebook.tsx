import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";
import { AgentState } from "@/lib/useExperiment";
import { NotebookCell } from "./NotebookCell";
import { StatusBadge } from "../StatusBadge";
import { cn } from "@/lib/utils";

interface AgentNotebookProps {
    agent: AgentState;
}

function AgentNotebookContent({ 
    agent, 
    isExpanded, 
    onToggleExpand, 
    isModal = false 
}: { 
    agent: AgentState;
    isExpanded: boolean;
    onToggleExpand: () => void;
    isModal?: boolean;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const autoScrollEnabledRef = useRef(true);
    const isProgrammaticScrollRef = useRef(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            isProgrammaticScrollRef.current = true;
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            // Small timeout to ensure the onScroll event fired by this change 
            // is ignored by our handler.
            setTimeout(() => {
                isProgrammaticScrollRef.current = false;
            }, 50);
        }
    };

    // Auto-scroll effect
    useEffect(() => {
        // We depend on the entire agent object to catch streaming updates
        if (autoScrollEnabledRef.current) {
            scrollToBottom();
        }
    }, [agent]);

    const handleScroll = () => {
        if (!scrollRef.current) return;

        // Ignore scroll events triggered by our auto-scroll
        if (isProgrammaticScrollRef.current) {
            return;
        }

        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

        if (isAtBottom) {
            // User is at the bottom, resume auto-scroll
            autoScrollEnabledRef.current = true;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        } else {
            // User scrolled away
            autoScrollEnabledRef.current = false;
            
            // Set/Reset 10s timeout to resume auto-scroll
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            
            timeoutRef.current = setTimeout(() => {
                autoScrollEnabledRef.current = true;
                // Optional: snap back to bottom immediately when timer fires?
                // The requirement says "goes back to auto-scroll-to-bottom", 
                // which we interpret as re-enabling the behavior. 
                // We'll also snap to bottom to make it clear the mode is back.
                scrollToBottom();
            }, 10000);
        }
    };

    return (
        <div className={cn(
            "flex flex-col h-full border border-border bg-card/50 backdrop-blur-sm rounded-xl transition-all duration-500",
            isModal ? "border-0 bg-background/95 rounded-none" : "hover:border-primary/20"
        )}>
            {/* Header - Ultra Minimal */}
            <div className="flex-shrink-0 h-12 px-4 border-b border-border flex items-center justify-between bg-card/50 rounded-t-xl">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold text-primary tracking-widest uppercase">
                        Agent {agent.id}
                    </span>
                    <div className="w-px h-3 bg-border" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                        {agent.gpu || "CPU"}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge status={agent.status} />
                    <button
                        onClick={onToggleExpand}
                        className="p-1.5 hover:bg-primary/10 rounded-md transition-colors text-muted-foreground hover:text-primary"
                    >
                        {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            {/* Hypothesis - Clean & Typography focused */}
            {agent.hypothesis && (
                <div className="flex-shrink-0 p-4 border-b border-border bg-background/50">
                    <div className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-2">
                        Objective
                    </div>
                    <div className={cn(
                        "text-xs text-muted-foreground font-light leading-relaxed",
                        !isExpanded && "line-clamp-2"
                    )}>
                        {agent.hypothesis}
                    </div>
                </div>
            )}

            {/* Notebook Content */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className={cn(
                    "flex-1 overflow-y-auto p-4 custom-scrollbar scroll-smooth",
                    isModal && "px-8 md:px-16" // Extra padding in modal mode
                )}
            >
                <div className={cn(
                    "space-y-8",
                    isModal && "max-w-4xl mx-auto" // Centered content in modal
                )}>
                    {agent.steps.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center min-h-[200px]">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse mb-3" />
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Initializing Environment</span>
                        </div>
                    ) : (
                        agent.steps.map((step) => (
                            <NotebookCell key={step.id} step={step} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export function AgentNotebook({ agent }: AgentNotebookProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Effect to handle body scroll locking when expanded
    useEffect(() => {
        if (isExpanded) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isExpanded]);

    return (
        <>
            {/* Default View */}
            <div className={cn("h-full", isExpanded && "invisible")}>
                <AgentNotebookContent 
                    agent={agent} 
                    isExpanded={isExpanded} 
                    onToggleExpand={() => setIsExpanded(!isExpanded)} 
                />
            </div>

            {/* Expanded Modal View */}
            {isExpanded && createPortal(
                <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-md animate-in fade-in duration-200 p-4 md:p-8">
                    <div className="w-full h-full rounded-xl overflow-hidden animate-in zoom-in-95 duration-300 border border-border shadow-2xl shadow-primary/5">
                        <AgentNotebookContent
                            agent={agent}
                            isExpanded={isExpanded}
                            onToggleExpand={() => setIsExpanded(!isExpanded)}
                            isModal={true}
                        />
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
