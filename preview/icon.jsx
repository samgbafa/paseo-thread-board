import { Archive, ChevronRight, Circle, Columns3, Network, RefreshCw } from "lucide-react";

const icons = { Archive, ChevronRight, Columns3, Network, RefreshCw };

export function Icon({ name, size = 16, color = "currentColor" }) {
  const Component = icons[name] ?? Circle;
  return <Component aria-hidden="true" width={size} height={size} color={color} strokeWidth={2} />;
}
