import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "idle" | "running" | "completed" | "failed" | "planning" | "reviewing";
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config: Record<StatusBadgeProps["status"], { text: string; dotColor: string; textColor: string; animate?: boolean }> = {
    idle: {
      text: "Idle",
      dotColor: "bg-muted-foreground",
      textColor: "text-muted-foreground",
    },
    running: {
      text: "Running",
      dotColor: "bg-primary",
      textColor: "text-primary",
      animate: true,
    },
    planning: {
      text: "Planning",
      dotColor: "bg-chart-4",
      textColor: "text-chart-4",
      animate: true,
    },
    reviewing: {
      text: "Reviewing",
      dotColor: "bg-chart-4",
      textColor: "text-chart-4",
      animate: true,
    },
    completed: {
      text: "Done",
      dotColor: "bg-chart-2",
      textColor: "text-chart-2",
    },
    failed: {
      text: "Failed",
      dotColor: "bg-destructive",
      textColor: "text-destructive",
    },
  };

  const { text, dotColor, textColor, animate } = config[status];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "h-1.5 w-1.5 rounded-full transition-colors duration-500",
          dotColor,
          animate && "animate-pulse"
        )}
      />
      <span className={cn("text-[10px] font-medium tracking-widest uppercase", textColor)}>
        {text}
      </span>
    </div>
  );
}
