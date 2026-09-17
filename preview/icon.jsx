import {
  Archive,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Columns3,
  CornerDownRight,
  Info,
  Layers,
  List,
  Network,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

const icons = {
  Archive,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Columns3,
  CornerDownRight,
  Info,
  Layers,
  List,
  Network,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
};

export function Icon({ name, size = 16, color = "currentColor" }) {
  const Component = icons[name];
  if (!Component) throw new Error(`Unknown preview icon: ${name}`);
  return <Component aria-hidden="true" width={size} height={size} color={color} strokeWidth={2} />;
}

export function Modal({ title, icon, open, onOpenChange, children }) {
  if (!open) return null;
  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0, 0, 0, 0.64)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          display: "flex",
          maxHeight: "min(760px, 92vh)",
          width: "min(620px, 100%)",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #303641",
          borderRadius: 16,
          background: "#111317",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.42)",
        }}
      >
        <div
          style={{
            display: "flex",
            minHeight: 56,
            alignItems: "center",
            gap: 10,
            padding: "0 16px",
            borderBottom: "1px solid #303641",
            color: "#f2f4f7",
            fontWeight: 700,
          }}
        >
          {icon}
          <span style={{ flex: 1 }}>{title}</span>
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={() => onOpenChange(false)}
            style={{
              width: 40,
              height: 40,
              border: 0,
              borderRadius: 10,
              background: "transparent",
              color: "#9ca4b3",
              cursor: "pointer",
            }}
          >
            <X aria-hidden="true" width={18} height={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

Modal.Content = function ModalContent({ children, style, contentContainerStyle }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", ...style }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: 24,
          gap: 16,
          ...contentContainerStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
};
