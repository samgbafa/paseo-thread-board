import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Columns3,
  CornerDownRight,
  Layers,
  List,
  Network,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

const icons = {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Columns3,
  CornerDownRight,
  Layers,
  List,
  Network,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
};

export function Icon({ name, size = 16, color = "currentColor" }) {
  const Component = icons[name];
  if (!Component) throw new Error(`Unknown preview icon: ${name}`);
  return <Component aria-hidden="true" width={size} height={size} color={color} strokeWidth={2} />;
}
