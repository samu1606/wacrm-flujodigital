"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  /** Friendly name shown in the error banner, e.g. "la lista de difusiones" */
  name?: string;
  children: ReactNode;
  /** Optional fallback rendered instead of the default error card */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: string | null;
}

/**
 * Isolated React Error Boundary — catches any uncaught render error in
 * its subtree and shows a small fallback card instead of taking down
 * the entire page with Next.js's default error overlay.
 *
 * Also logs the full error + component stack to `console.error` so the
 * browser devtools capture the exact line that crashed.
 */
export class SafeRender extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const stack = errorInfo.componentStack ?? "no component stack";
    console.error(
      `[SafeRender] ${this.props.name ?? "(unnamed)"} crashed:\n`,
      error,
      "\nComponent stack:\n",
      stack,
    );
    // Capture last meaningful line for the banner
    const lines = stack.split("\n").filter(Boolean);
    const top = lines.slice(0, 5).join("\n");
    this.setState({ errorInfo: top });
  }

  render() {
    if (this.state.error) {
      const { name } = this.props;
      // If caller provided a custom fallback, render it.
      if (this.props.fallback !== undefined) return this.props.fallback;

      return (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-red-400">
                Error al renderizar{name ? ` ${name}` : ""}
              </p>
              <p className="text-xs text-muted-foreground break-all font-mono">
                {this.state.error.message}
              </p>
              {this.state.errorInfo && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground/70">
                    Stack del componente
                  </summary>
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[10px] text-muted-foreground/50">
                    {this.state.errorInfo}
                  </pre>
                </details>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => this.setState({ error: null, errorInfo: null })}
                className="h-7 text-xs"
              >
                Reintentar
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
