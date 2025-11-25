import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp, Sparkles, FileText, X } from "lucide-react";
import { ReviewState } from "@/lib/useExperiment";
import { cn } from "@/lib/utils";

interface PeerReviewProps {
    review: ReviewState;
}

function ScoreBadge({ score, approved }: { score?: number; approved?: boolean }) {
    const getScoreColor = (score: number) => {
        if (score >= 8) return "text-chart-2 bg-chart-2/10 border-chart-2/30";
        if (score >= 6) return "text-chart-4 bg-chart-4/10 border-chart-4/30";
        return "text-destructive bg-destructive/10 border-destructive/30";
    };

    if (score === undefined) return null;

    return (
        <div className="flex items-center gap-3">
            <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold",
                getScoreColor(score)
            )}>
                <span>{score}</span>
                <span className="text-xs opacity-70">/10</span>
            </div>
            {approved !== undefined && (
                <div className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium",
                    approved
                        ? "text-chart-2 bg-chart-2/10 border-chart-2/30"
                        : "text-chart-3 bg-chart-3/10 border-chart-3/30"
                )}>
                    {approved ? (
                        <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approved
                        </>
                    ) : (
                        <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            Needs Revision
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function ReviewSection({
    title,
    items,
    icon: Icon,
    variant = "default"
}: {
    title: string;
    items: string[];
    icon: React.ElementType;
    variant?: "success" | "warning" | "default";
}) {
    if (!items || items.length === 0) return null;

    const variantStyles = {
        success: "border-chart-2/20 bg-chart-2/5",
        warning: "border-chart-3/20 bg-chart-3/5",
        default: "border-border bg-card/50",
    };

    const iconStyles = {
        success: "text-chart-2",
        warning: "text-chart-3",
        default: "text-primary",
    };

    return (
        <div className={cn("rounded-lg border p-4", variantStyles[variant])}>
            <div className="flex items-center gap-2 mb-3">
                <Icon className={cn("w-4 h-4", iconStyles[variant])} />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {title}
                </span>
            </div>
            <ul className="space-y-2">
                {items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-secondary-foreground">
                        <span className="text-muted-foreground mt-1">•</span>
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function PeerReview({ review }: PeerReviewProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showFullView, setShowFullView] = useState(false);

    // Show loading state while reviewing
    if (review.status === "reviewing") {
        return (
            <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="border border-border bg-card/50 backdrop-blur-sm rounded-xl overflow-hidden">
                    <div className="h-12 px-4 border-b border-border flex items-center gap-3 bg-card/50">
                        <Sparkles className="w-4 h-4 text-chart-4 animate-pulse" />
                        <span className="text-[10px] font-semibold text-chart-4 tracking-widest uppercase">
                            Gemini Peer Review
                        </span>
                        <div className="flex-1" />
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-chart-4 animate-pulse" />
                            <span className="text-[10px] text-muted-foreground">Analyzing...</span>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex items-center justify-center py-8">
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    <div className="w-12 h-12 border-2 border-chart-4/30 rounded-full animate-spin border-t-chart-4" />
                                </div>
                                <p className="text-sm text-muted-foreground">Reviewing paper quality...</p>
                            </div>
                        </div>
                        {review.streamContent && (
                            <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
                                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-40 overflow-y-auto custom-scrollbar">
                                    {review.streamContent}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (review.status === "error") {
        return (
            <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-destructive">
                        <XCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Review failed</span>
                    </div>
                </div>
            </div>
        );
    }

    // Complete review
    return (
        <>
            <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="border border-border bg-card/50 backdrop-blur-sm rounded-xl overflow-hidden hover:border-primary/20 transition-colors">
                    {/* Header */}
                    <div className="h-12 px-4 border-b border-border flex items-center justify-between bg-card/50">
                        <div className="flex items-center gap-3">
                            <Sparkles className="w-4 h-4 text-chart-4" />
                            <span className="text-[10px] font-semibold text-chart-4 tracking-widest uppercase">
                                Peer Review Complete
                            </span>
                        </div>
                        <ScoreBadge score={review.score} approved={review.approved} />
                    </div>

                    {/* Assessment Summary */}
                    <div className="p-6 space-y-4">
                        {review.assessment && (
                            <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                                <p className="text-sm text-secondary-foreground leading-relaxed">
                                    {review.assessment}
                                </p>
                            </div>
                        )}

                        {/* Expandable Details */}
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                            {isExpanded ? (
                                <>
                                    <ChevronUp className="w-3.5 h-3.5" />
                                    Hide Details
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="w-3.5 h-3.5" />
                                    View Full Review
                                </>
                            )}
                        </button>

                        {isExpanded && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-4 pt-2"
                            >
                                <div className="grid md:grid-cols-2 gap-4">
                                    <ReviewSection
                                        title="Strengths"
                                        items={review.strengths || []}
                                        icon={CheckCircle2}
                                        variant="success"
                                    />
                                    <ReviewSection
                                        title="Weaknesses"
                                        items={review.weaknesses || []}
                                        icon={AlertCircle}
                                        variant="warning"
                                    />
                                </div>

                                {review.suggestions && review.suggestions.length > 0 && (
                                    <ReviewSection
                                        title="Suggestions for Improvement"
                                        items={review.suggestions}
                                        icon={Sparkles}
                                        variant="default"
                                    />
                                )}

                                <button
                                    onClick={() => setShowFullView(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-primary/10 border border-border hover:border-primary/50 text-xs font-medium text-muted-foreground hover:text-primary transition-all"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    Open Full Review
                                </button>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {/* Full Review Modal */}
            {showFullView && createPortal(
                <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-md animate-in fade-in duration-200 flex items-center justify-center p-4 md:p-8">
                    <div className="w-full max-w-3xl max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-card shrink-0">
                            <div className="flex items-center gap-3">
                                <Sparkles className="w-5 h-5 text-chart-4" />
                                <span className="text-sm font-semibold text-foreground">
                                    Gemini Peer Review
                                </span>
                            </div>
                            <div className="flex items-center gap-4">
                                <ScoreBadge score={review.score} approved={review.approved} />
                                <button
                                    onClick={() => setShowFullView(false)}
                                    className="p-2 hover:bg-secondary rounded-lg transition-colors"
                                >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {review.assessment && (
                                <div>
                                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                                        Overall Assessment
                                    </h3>
                                    <p className="text-sm text-secondary-foreground leading-relaxed p-4 bg-secondary/50 rounded-lg border border-border">
                                        {review.assessment}
                                    </p>
                                </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-6">
                                <ReviewSection
                                    title="Strengths"
                                    items={review.strengths || []}
                                    icon={CheckCircle2}
                                    variant="success"
                                />
                                <ReviewSection
                                    title="Weaknesses"
                                    items={review.weaknesses || []}
                                    icon={AlertCircle}
                                    variant="warning"
                                />
                            </div>

                            {review.suggestions && review.suggestions.length > 0 && (
                                <ReviewSection
                                    title="Suggestions for Improvement"
                                    items={review.suggestions}
                                    icon={Sparkles}
                                    variant="default"
                                />
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
