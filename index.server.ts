import type { PluginServerContext } from "@getpaseo/plugin/server";
import { threadBoardViewOptions } from "./shared/view-options";

export default function contribute(server: PluginServerContext) {
  server.registerSettings(threadBoardViewOptions);
  return () => {};
}
