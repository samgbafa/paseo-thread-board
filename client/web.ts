import { Platform } from "react-native";

interface ContextMenuEvent {
  preventDefault(): void;
  stopPropagation?(): void;
}

interface WebContextMenuProps {
  onContextMenu?(event: ContextMenuEvent): void;
}

export function webContextMenuProps(onOpen: () => void): WebContextMenuProps {
  if (Platform.OS !== "web") return {};
  return {
    onContextMenu(event) {
      event.preventDefault();
      event.stopPropagation?.();
      onOpen();
    },
  };
}
