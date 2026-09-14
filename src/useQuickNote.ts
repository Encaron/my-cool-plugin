/**
 * 双段快捷键命令——`my-cool-plugin.quickNote`（⌨ `ctrl+k ctrl+q`，声明在 plugin.json 的
 * `contributes.keybindings`）。
 *
 * 为什么单抽一个 hook、并且**两个表面都调**：
 *   命令 handler 只在「本插件有表面在挂载」时才存在。若只在侧栏注册 ⇒ 侧栏收起（或用户只开着
 *   主区标签）时，按键会命中一个**没注册的命令** = 死键。两侧各注册一次、同 id 幂等覆盖 ⇒
 *   任一表面在挂载即可用。本命令同时是「keybindings 接入点」的实测样本（L4 最后一格）。
 *
 * 与 titleActions 里「＋ 新建便签」的唯一区别：本命令额外发一条**带 ⌨ 前缀的回执通知**——
 * 让「按了快捷键」与「点了按钮」肉眼可分（命令面板里点同一条命令也会走到这里）。
 */

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { PLUGIN_ID } from "./board";
import type { BoardApi } from "./useBoard";

export function useQuickNoteCommand(api: BoardApi): void {
  const { t } = useTranslation();
  // handler 只注册一次 ⇒ 闭包里绝不能捕获首帧 state（同 NotesView 的 live ref 纪律）
  const live = useRef(api);
  live.current = api;

  useEffect(() => {
    const commands = window.linkdesk?.commands;
    if (!commands?.registerCommand) return;
    commands.registerCommand("my-cool-plugin.quickNote", () => {
      void window.linkdesk.tabs.openOrFocus(PLUGIN_ID);
      live.current.addNote();
      void window.linkdesk.notifications.show(t("⌨ 快捷键生效：已新建一条便签"), { type: "info" });
    });
  }, [t]);
}
