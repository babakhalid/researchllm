import { Terminal, ArrowRight } from "lucide-react";
import { ExperimentStep } from "@/lib/useExperiment";
import { StreamingMarkdown } from "../StreamingMarkdown";

interface NotebookCellProps {
    step: ExperimentStep;
}

export function NotebookCell({ step }: NotebookCellProps) {
    const { type, content, id } = step;

    if (type === "thought") {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                    <span className="text-[10px] font-semibold text-primary/70 uppercase tracking-widest">Thinking</span>
                </div>
                <div className="pl-3 border-l-2 border-primary/20 ml-0.5">
                    <StreamingMarkdown
                        animateKey={id}
                        content={content}
                        markdownClassName="prose prose-invert prose-sm max-w-none prose-p:text-muted-foreground prose-p:text-xs prose-p:leading-relaxed prose-p:font-light prose-headings:text-foreground prose-strong:text-foreground prose-code:text-primary/80 prose-pre:bg-card prose-pre:border prose-pre:border-border [&>*:first-child]:mt-0"
                    />
                </div>
            </div>
        );
    }

    if (type === "code") {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center gap-2 mb-2">
                    <Terminal className="w-3 h-3 text-chart-3" />
                    <span className="text-[10px] font-semibold text-chart-3/80 uppercase tracking-widest">Command</span>
                </div>
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <pre className="p-3 text-[10px] font-mono text-foreground overflow-x-auto custom-scrollbar">
                        {content}
                    </pre>
                </div>
            </div>
        );
    }

    if (type === "result") {
        // Handle carriage returns (\r) for progress bars (like tqdm).
        // We want to simulate the terminal behavior where \r moves the cursor
        // to the start of the line, allowing subsequent text to overwrite.
        // We split by \r and take the last segment for the current line context if it's a pure overwrite,
        // but \r can be mixed with \n.
        // A simple approximation is: split by \n, and for each line, process \r.

        const processCarriageReturns = (text: string) => {
            const lines = text.split('\n');
            const processedLines = lines.map(line => {
                // If line has \r, usually we just want the text AFTER the last \r
                // unless that \r is followed by nothing?
                // Standard terminal: "Loading... 10%\rLoading... 20%" -> "Loading... 20%"
                // "Item 1\rItem 2" -> "Item 2"

                if (line.includes('\r')) {
                    const parts = line.split('\r');
                    return parts[parts.length - 1];
                }
                return line;
            });
            return processedLines.join('\n');
        };

        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center gap-2 mb-2">
                    <ArrowRight className="w-3 h-3 text-chart-2" />
                    <span className="text-[10px] font-semibold text-chart-2/80 uppercase tracking-widest">Output</span>
                </div>
                <div className="pl-3 border-l-2 border-chart-2/20 ml-0.5">
                    <pre className="text-[10px] font-mono text-muted-foreground overflow-x-auto custom-scrollbar whitespace-pre-wrap">
                        {processCarriageReturns(content)}
                    </pre>
                </div>
            </div>
        );
    }

    return null;
}
