import { useState, useEffect, useRef } from "react";
import { Loader2, Play, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useExperiment } from "@/lib/useExperiment";
import { FindingsRail } from "./FindingsRail";
import { AgentNotebook } from "./Notebook/AgentNotebook";
import { ResearchPaper } from "./Notebook/ResearchPaper";
import { PeerReview } from "./Notebook/PeerReview";
import { cn } from "@/lib/utils";
import { StreamingMarkdown } from "./StreamingMarkdown";
import { CredentialPrompt, CredentialFormState } from "./CredentialPrompt";
import { CredentialStatus, fetchCredentialStatus, saveCredentials } from "@/lib/api";

type PendingRun = {
  mode: "single" | "orchestrator";
  config: {
    task: string;
    gpu?: string;
    model?: string;
    num_agents?: number;
    max_rounds?: number;
    max_parallel?: number;
    test_mode?: boolean;
  };
};

export function LabNotebook() {
  const { isRunning, agents, orchestrator, startExperiment } = useExperiment();
  const [task, setTask] = useState("");
  const [mode, setMode] = useState<"single" | "orchestrator">("orchestrator");
  const [testMode, setTestMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevTimelineLengthRef = useRef(0);
  const [credentialStatus, setCredentialStatus] = useState<CredentialStatus | null>(null);
  const [credentialForm, setCredentialForm] = useState<CredentialFormState>({
    googleApiKey: "",
    anthropicApiKey: "",
    modalTokenId: "",
    modalTokenSecret: "",
  });
  const [selectedModel, setSelectedModel] = useState<"gemini-3-pro-preview" | "claude-opus-4-5">("gemini-3-pro-preview");
  const [showCredentialPrompt, setShowCredentialPrompt] = useState(false);
  const [pendingRun, setPendingRun] = useState<PendingRun | null>(null);
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [prereqError, setPrereqError] = useState<string | null>(null);
  const [credentialPromptError, setCredentialPromptError] = useState<string | null>(null);

  // Check credentials once on load so we can prompt proactively.
  useEffect(() => {
    fetchCredentialStatus()
      .then(setCredentialStatus)
      .catch(() => {
        // silently ignore so we don't block the UI if the backend isn't ready yet
      });
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    const currentLength = orchestrator.timeline.length;
    const prevLength = prevTimelineLengthRef.current;

    if (currentLength > prevLength) {
      const lastItem = orchestrator.timeline[currentLength - 1];
      if (lastItem.type === "agents" || lastItem.type === "paper" || currentLength === 1) {
        // Scroll slightly above the new element to keep context
        // We do this by scrolling to the bottom ref, but with 'start' block alignment if possible,
        // or just letting the padding handle it.
        // Actually, let's scroll to the *element itself* if we could, but since we use bottomRef,
        // let's just scroll smoothly to it. 
        // The user said it "goes a little too far", implying it might be scrolling past the top of the new content.
        // Or maybe it scrolls so the bottom is at the bottom of the screen?
        // "scrollIntoView" aligns the element to the top or bottom. 
        
        // Let's try aligning the bottomRef to the 'end' of the view, but give it some breathing room.
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }
    
    prevTimelineLengthRef.current = currentLength;
  }, [orchestrator.timeline]);

  const handleStart = async () => {
    if (!task.trim() || isCheckingCredentials) return;

    const config = {
      task,
      gpu: "any",
      model: selectedModel,
      num_agents: 3,
      max_rounds: 3,
      max_parallel: 2,
      test_mode: testMode,
    };

    setPrereqError(null);
    setCredentialPromptError(null);
    setIsCheckingCredentials(true);

    try {
      const status = await fetchCredentialStatus();
      setCredentialStatus(status);

      // Check if the required key for the selected model is available
      const needsGoogleKey = selectedModel === "gemini-3-pro-preview" && !status.hasGoogleApiKey;
      const needsAnthropicKey = selectedModel === "claude-opus-4-5" && !status.hasAnthropicApiKey;
      const needsModalToken = !status.hasModalToken;

      if (needsGoogleKey || needsAnthropicKey || needsModalToken) {
        setPendingRun({ mode, config });
        setShowCredentialPrompt(true);
        return;
      }

      startExperiment(mode, config);
    } catch (err) {
      setPrereqError(err instanceof Error ? err.message : "Unable to verify API keys.");
    } finally {
      setIsCheckingCredentials(false);
    }
  };

  const handleCredentialFieldChange = (field: keyof CredentialFormState, value: string) => {
    setCredentialForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveCredentials = async () => {
    setCredentialPromptError(null);
    setIsSavingCredentials(true);

    try {
      const status = await saveCredentials({
        googleApiKey: credentialForm.googleApiKey || undefined,
        anthropicApiKey: credentialForm.anthropicApiKey || undefined,
        modalTokenId: credentialForm.modalTokenId || undefined,
        modalTokenSecret: credentialForm.modalTokenSecret || undefined,
      });
      setCredentialStatus(status);

      // Check if we have the required key for the selected model
      const hasRequiredLLMKey = selectedModel === "gemini-3-pro-preview"
        ? status.hasGoogleApiKey
        : status.hasAnthropicApiKey;

      if (hasRequiredLLMKey && status.hasModalToken) {
        setShowCredentialPrompt(false);
        setCredentialForm({ googleApiKey: "", anthropicApiKey: "", modalTokenId: "", modalTokenSecret: "" });
        const nextRun = pendingRun;
        setPendingRun(null);
        if (nextRun) {
          startExperiment(nextRun.mode, nextRun.config);
        }
      } else {
        const modelName = selectedModel === "gemini-3-pro-preview" ? "Google" : "Anthropic";
        setCredentialPromptError(`We still need the ${modelName} API key and Modal token to start a run with the selected model.`);
      }
    } catch (err) {
      setCredentialPromptError(err instanceof Error ? err.message : "Unable to save credentials.");
    } finally {
      setIsSavingCredentials(false);
    }
  };

  const handleCloseCredentialPrompt = () => {
    setShowCredentialPrompt(false);
    setPendingRun(null);
  };

  const isStartDisabled = !task.trim() || isCheckingCredentials;

  return (
    <div className="flex h-screen w-full bg-background font-sans text-foreground selection:bg-primary/20 selection:text-foreground relative overflow-hidden">
      {/* Background mesh gradient */}
      <div className="absolute inset-0 bg-mesh pointer-events-none" />
      <div className="absolute inset-0 noise pointer-events-none opacity-50" />

      <div className="flex-1 h-full overflow-hidden flex flex-col relative z-10">

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative">

        {/* Sticky Header for Active Research */}
        {orchestrator.timeline.length > 0 && (
            <div className="absolute top-0 left-0 right-0 z-50 glass animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="max-w-5xl mx-auto px-8 py-4 flex items-center gap-4">
                    <span className="text-[10px] font-semibold text-primary uppercase tracking-widest shrink-0">
                        Objective
                    </span>
                    <div className="h-4 w-px bg-border" />
                    <p className="text-sm font-light text-muted-foreground truncate">
                        {task}
                    </p>
                </div>
            </div>
        )}
        
        {/* Scrollable Timeline */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-5xl mx-auto py-24 px-8 space-y-32">
                
                {/* Initial Input State (Only visible when timeline is empty and not running) */}
                {orchestrator.timeline.length === 0 && !isRunning && (
                    <div className="min-h-[60vh] flex flex-col justify-center items-center space-y-12 animate-in fade-in duration-1000">
                        <div className="space-y-6 text-center max-w-lg">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                <span className="text-xs font-medium text-primary tracking-wide">AI-researcher</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight bg-gradient-to-br from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                                Research Objective
                            </h1>
                            <p className="text-lg text-muted-foreground font-light leading-relaxed">
                                Describe your scientific query. The orchestrator will decompose it into hypotheses and launch autonomous agents to investigate.
                            </p>
                        </div>

                        <div className="w-full max-w-xl space-y-8">
                            <div className="relative group">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition duration-500"></div>
                                <textarea
                                    value={task}
                                    onChange={(e) => setTask(e.target.value)}
                                    disabled={isRunning}
                                    placeholder="e.g., Investigate the scaling laws of sparse attention mechanisms..."
                                    className="relative w-full h-32 bg-card border border-border rounded-xl p-6 text-lg font-light text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:outline-none resize-none leading-relaxed transition-all duration-300"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setTestMode(!testMode)}
                                        className={cn(
                                            "text-[10px] font-semibold px-3 py-1.5 rounded-full transition-all duration-300 border",
                                            testMode
                                                ? "bg-primary text-primary-foreground border-primary shadow-glow"
                                                : "bg-secondary text-muted-foreground hover:text-foreground border-border hover:border-primary/30"
                                        )}
                                    >
                                        {testMode ? "TEST MODE" : "LIVE MODE"}
                                    </button>
                                    <div className="h-4 w-px bg-border" />
                                    <select
                                        value={mode}
                                        onChange={(e) => setMode(e.target.value as "single" | "orchestrator")}
                                        className="bg-transparent text-muted-foreground text-xs font-medium focus:outline-none cursor-pointer hover:text-foreground transition-colors"
                                    >
                                        <option value="single">Single Agent</option>
                                        <option value="orchestrator">Agent Swarm</option>
                                    </select>
                                    <div className="h-4 w-px bg-border" />
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value as "gemini-3-pro-preview" | "claude-opus-4-5")}
                                        className="bg-transparent text-muted-foreground text-xs font-medium focus:outline-none cursor-pointer hover:text-foreground transition-colors"
                                    >
                                        <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                                        <option value="claude-opus-4-5">Claude Opus 4.5</option>
                                    </select>
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                    <button
                                        onClick={handleStart}
                                        disabled={isStartDisabled}
                                        className={cn(
                                            "px-8 py-3 rounded-xl text-xs font-semibold tracking-widest uppercase transition-all duration-300 flex items-center gap-2",
                                            isStartDisabled
                                                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                                                : "bg-primary text-primary-foreground hover:shadow-glow-lg hover:scale-[1.02] active:scale-[0.98]"
                                        )}
                                    >
                                        {isCheckingCredentials ? (
                                            <>
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                <span>Checking keys...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-3 h-3 fill-current" />
                                                <span>Start Research</span>
                                            </>
                                        )}
                                    </button>
                                    {prereqError && (
                                        <p className="text-xs text-destructive text-right max-w-sm">
                                            {prereqError}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading State (Visible when running but no timeline events yet) */}
                {orchestrator.timeline.length === 0 && isRunning && (
                    <div className="min-h-[60vh] flex flex-col justify-center items-center space-y-8 animate-in fade-in duration-700">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
                            <div className="relative w-16 h-16 border-t-2 border-primary rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
                            </div>
                        </div>
                        <div className="space-y-2 text-center">
                            <h2 className="text-xl font-medium text-foreground tracking-wide animate-pulse">
                                Initializing Research Environment
                            </h2>
                            <p className="text-sm text-muted-foreground font-mono">
                                Spinning up main agent...
                            </p>
                        </div>
                    </div>
                )}

                {/* Timeline Rendering */}
                {orchestrator.timeline.map((item, index) => {
                    const key = item.timestamp ?? `${item.type}-${index}`;
                    if (item.type === "thought") {
                        return (
                            <motion.div
                                key={key}
                                initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="w-full"
                            >
                                <div className="pl-6 border-l-2 border-primary/30 py-2">
                                    <span className="block text-[10px] font-semibold text-primary uppercase tracking-widest mb-3">
                                        Orchestrator
                                    </span>
                                    <StreamingMarkdown
                                        animateKey={key}
                                        content={item.content}
                                        markdownClassName="prose prose-invert prose-lg md:prose-xl max-w-none prose-p:text-muted-foreground prose-p:font-light prose-p:leading-relaxed prose-strong:text-foreground prose-headings:text-foreground prose-code:text-primary/80 prose-pre:bg-card prose-pre:border prose-pre:border-border"
                                    />
                                </div>
                            </motion.div>
                        );
                    } else if (item.type === "agents") {
                        return (
                            <motion.div
                                key={key}
                                initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="space-y-8"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-px w-8 bg-gradient-to-r from-primary/50 to-transparent" />
                                    <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">
                                        Sub-Agents Deployed
                                    </span>
                                    <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
                                </div>
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                    {item.agentIds.map((agentId) => {
                                        const agent = agents[agentId];
                                        if (!agent) return null;
                                        return (
                                            <div key={agentId} className="h-[600px]">
                                                <AgentNotebook agent={agent} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        );
                    } else if (item.type === "draft") {
                        return (
                            <motion.div
                                key={key}
                                initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="w-full"
                            >
                                <div className="border border-chart-4/30 bg-card/50 backdrop-blur-sm rounded-xl overflow-hidden">
                                    <div className="h-12 px-4 border-b border-border flex items-center gap-3 bg-card/50">
                                        <FileText className="w-4 h-4 text-chart-4" />
                                        <span className="text-[10px] font-semibold text-chart-4 tracking-widest uppercase">
                                            Draft Paper Generated
                                        </span>
                                        <div className="flex-1" />
                                        <span className="text-[10px] text-muted-foreground">
                                            Awaiting peer review...
                                        </span>
                                    </div>
                                    <div className="p-6 max-h-[300px] overflow-hidden relative">
                                        <div className="prose prose-invert prose-sm max-w-none prose-p:text-muted-foreground">
                                            <StreamingMarkdown
                                                animateKey={key}
                                                content={item.content.slice(0, 2000) + (item.content.length > 2000 ? "..." : "")}
                                                markdownClassName="prose prose-invert prose-sm max-w-none prose-p:text-muted-foreground prose-p:font-light"
                                            />
                                        </div>
                                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                                    </div>
                                </div>
                            </motion.div>
                        );
                    } else if (item.type === "review") {
                        return (
                            <motion.div
                                key={key}
                                initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="w-full"
                            >
                                <PeerReview review={item.review} />
                            </motion.div>
                        );
                    } else if (item.type === "paper") {
                        return (
                            <motion.div
                                key={key}
                                initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                            >
                                <ResearchPaper content={item.content} charts={item.charts} reviewScore={item.reviewScore} />
                            </motion.div>
                        );
                    }
                    return null;
                })}
                
                {/* Running Indicator at Bottom */}
                {isRunning && orchestrator.timeline.length > 0 && (
                    <div className="flex justify-center py-12">
                        <div className={cn(
                            "flex items-center gap-3 px-4 py-2 rounded-full bg-card border shadow-glow",
                            orchestrator.status === "reviewing"
                                ? "border-chart-4/20"
                                : "border-primary/20"
                        )}>
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full animate-pulse",
                                orchestrator.status === "reviewing" ? "bg-chart-4" : "bg-primary"
                            )} />
                            <span className={cn(
                                "text-[10px] font-semibold uppercase tracking-widest",
                                orchestrator.status === "reviewing" ? "text-chart-4" : "text-primary"
                            )}>
                                {orchestrator.status === "reviewing" ? "Peer Reviewing" : "Orchestrating"}
                            </span>
                        </div>
                    </div>
                )}

                <div ref={bottomRef} className="h-10" />
            </div>
        </div>
      </main>

      </div>
      {/* Summaries rail on the right */}
      <FindingsRail agents={agents} />

      {/* Minimal Fixed Header (Only visible when running) */}
      {isRunning && (
          <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gradient-to-r from-primary via-accent to-chart-4 animate-gradient" />
      )}

      <CredentialPrompt
        open={showCredentialPrompt}
        status={credentialStatus}
        selectedModel={selectedModel}
        form={credentialForm}
        onChange={handleCredentialFieldChange}
        onSubmit={handleSaveCredentials}
        onClose={handleCloseCredentialPrompt}
        isSaving={isSavingCredentials}
        error={credentialPromptError}
      />
    </div>
  );
}
