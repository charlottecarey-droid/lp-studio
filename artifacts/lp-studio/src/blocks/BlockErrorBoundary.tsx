import { Component, type ErrorInfo, type ReactNode } from "react";

interface BlockErrorBoundaryProps {
  /** Block type, used for logging and the editor-facing fallback card. */
  blockType: string;
  /** True when rendering in the builder/editor (shows a visible fallback card).
   *  When false (live/published pages) a failed block renders nothing at all,
   *  so visitors never see an error card. */
  isEditor: boolean;
  children: ReactNode;
}

interface BlockErrorBoundaryState {
  hasError: boolean;
}

/** Per-block render-error boundary. Wraps every block at BlockRenderer's single
 *  dispatch point so one crashing block can't take down the whole page. Mount it
 *  with a `key` derived from the block id/type so the boundary resets when the
 *  block changes. */
export class BlockErrorBoundary extends Component<BlockErrorBoundaryProps, BlockErrorBoundaryState> {
  constructor(props: BlockErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): BlockErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error(`[BlockErrorBoundary] "${this.props.blockType}" block failed to render:`, err, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (!this.props.isEditor) return null;
      return (
        <div
          role="alert"
          style={{
            margin: "0.5rem",
            padding: "1.5rem",
            border: "1px dashed #cbd5e1",
            borderRadius: "0.5rem",
            backgroundColor: "#f8fafc",
            color: "#64748b",
            fontSize: "0.85rem",
            textAlign: "center",
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>This section failed to render</p>
          <p style={{ fontSize: "0.75rem" }}>Block type: {this.props.blockType}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
