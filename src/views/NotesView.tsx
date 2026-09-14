/**
 * 便签板·侧栏视图——便签列表 + 快速操作。
 *
 * 这是**一个 view 组件**：只负责内容区域。折叠头 / 容器 header 由 SidebarSection 统一管理，
 * 右侧动作区（新建 / 打开标签页）走 plugin.json 的 titleActions 声明制——这里不自己画 header。
 * 不要自己包 SidebarSection（见 08-ViewContainer-视图容器API §六）。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, ContextMenu, InlineInput, useDebouncedInput } from "@linkdesk/ui";
import { PLUGIN_ID, isPinned, noteSnippet, noteTitleOf, sortNotes, type Note } from "../board";
import { CONFIG_HIDE_COMPLETED, CONFIG_PINNED_TITLES, useBoard, useConfig } from "../useBoard";
import { useQuickNoteCommand } from "../useQuickNote";

interface MenuAnchor {
  x: number;
  y: number;
  noteId: string;
}

export default function NotesView() {
  const { t } = useTranslation();
  const boardApi = useBoard();
  const { board, ready, activeNote, addNote, updateNote, removeNote, clearDone, setActive } = boardApi;
  // ⌨ 双段快捷键命令——与主区标签页各注册一次（同 id 幂等覆盖），见 useQuickNote.ts 头注释
  useQuickNoteCommand(boardApi);

  const hideCompleted = useConfig<boolean>(CONFIG_HIDE_COMPLETED, false);
  const pinnedTitles = useConfig<string[]>(CONFIG_PINNED_TITLES, []);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const search = useDebouncedInput(() => {}, 150);

  // 命令 handler 只注册一次 → 闭包里绝不能捕获 state（注册时的首帧值会永久固化）。
  // 一律经 ref 取「当前值」——[[react-stale-closure-setstate-invoke]] 的同款纪律。
  const live = useRef({ addNote, updateNote, removeNote, clearDone, setActive, activeNote, board });
  live.current = { addNote, updateNote, removeNote, clearDone, setActive, activeNote, board };

  // 池侧命令注册——titleActions / 右键菜单 / 命令面板声明的命令，执行真相源都在这里
  // （插件自注册，壳零改动）。故意**不**在 unmount 注销：侧栏收起时视图会卸载，
  // 注销会让 contributes.commands 里的命令变成点了没反应的死条目；
  // 重挂载时同 id 重注册 = 幂等覆盖，handler 经 ref 恒取最新值。
  useEffect(() => {
    const api = window.linkdesk?.commands;
    if (!api?.registerCommand) return;

    api.registerCommand("my-cool-plugin.newNote", () => {
      void window.linkdesk.tabs.openOrFocus(PLUGIN_ID);
      live.current.addNote();
    });

    api.registerCommand("my-cool-plugin.openInTab", () => {
      void window.linkdesk.tabs.openOrFocus(PLUGIN_ID);
    });

    api.registerCommand("my-cool-plugin.clearDone", () => {
      const n = live.current.clearDone();
      void window.linkdesk.notifications.show(
        n > 0 ? t("已清理 {{n}} 条已完成便签", { n }) : t("没有已完成的便签"),
        { type: "info" },
      );
    });

    api.registerCommand("my-cool-plugin.renameNote", (ctx: unknown) => {
      const id = (ctx as { noteId?: string } | undefined)?.noteId ?? live.current.activeNote?.id;
      if (id) setRenamingId(id);
    });

    api.registerCommand("my-cool-plugin.deleteNote", (ctx: unknown) => {
      const id = (ctx as { noteId?: string } | undefined)?.noteId ?? live.current.activeNote?.id;
      const note = id ? live.current.board.notes.find((n) => n.id === id) : undefined;
      if (!note) {
        void window.linkdesk.notifications.show(t("请先选一条便签"), { type: "warning" });
        return;
      }
      // 要用户当场决定 → dialog.confirm（模态、抢焦点），不是通知
      void window.linkdesk.dialog.confirm(t("删除便签「{{title}}」？", { title: t(noteTitleOf(note)) })).then((ok) => {
        if (ok) live.current.removeNote(note.id);
      });
    });
  }, [t]);

  const visible = useMemo(() => {
    const q = search.value.trim().toLowerCase();
    return sortNotes(board.notes, pinnedTitles).filter((n) => {
      if (hideCompleted && n.done) return false;
      if (!q) return true;
      return `${n.title}\n${n.body}`.toLowerCase().includes(q);
    });
  }, [board.notes, pinnedTitles, hideCompleted, search.value]);

  const onActivate = (note: Note) => {
    setActive(note.id);
    void window.linkdesk.tabs.openOrFocus(PLUGIN_ID);
  };

  return (
    <div className="mcp-sidebar">
      <div className="mcp-search">
        <input
          className="mcp-search__input"
          type="search"
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder={t("搜索便签")}
          spellCheck={false}
        />
      </div>

      {!ready ? (
        <div className="mcp-empty">{t("正在读取便签…")}</div>
      ) : visible.length === 0 ? (
        <div className="mcp-empty">
          {board.notes.length === 0 ? t("还没有便签——点上方 ＋ 新建一条") : t("没有匹配的便签")}
        </div>
      ) : (
        <div className="mcp-list" role="listbox" aria-label={t("便签列表")}>
          {visible.map((note) => (
            <div
              key={note.id}
              role="option"
              aria-selected={note.id === board.activeNoteId}
              className={`mcp-item${note.id === board.activeNoteId ? " is-active" : ""}`}
              // 侧栏垂直列表用 onMouseDown 而不是 onClick——防快速点击跨元素丢事件（05 §7）
              onMouseDown={() => onActivate(note)}
              onDoubleClick={() => setRenamingId(note.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, noteId: note.id });
              }}
            >
              <span className="mcp-item__dot" style={{ background: note.color }} aria-hidden />
              <span className="mcp-item__main">
                {renamingId === note.id ? (
                  <InlineInput
                    size="compact"
                    value={note.title}
                    autoFocus
                    placeholder={t("便签标题")}
                    onConfirm={(v) => {
                      updateNote(note.id, { title: v.trim() });
                      setRenamingId(null);
                    }}
                    onCancel={() => setRenamingId(null)}
                  />
                ) : (
                  <span className={`mcp-item__title${note.done ? " is-done" : ""}`}>{t(noteTitleOf(note))}</span>
                )}
                <span className="mcp-item__snippet">{noteSnippet(note.body) || t("（空）")}</span>
              </span>
              <span className="mcp-item__marks">
                {isPinned(note, pinnedTitles) && <span title={t("已置顶")}>📌</span>}
                {note.done && <Badge title={t("已完成")}>✓</Badge>}
                {note.priority >= 80 && <Badge title={t("高优先级")}>{note.priority}</Badge>}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mcp-foot">
        <span className="mcp-foot__count">{t("{{n}} 条便签", { n: board.notes.length })}</span>
        <button
          type="button"
          className="mcp-linkbtn"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => void window.linkdesk.tabs.openOrFocus(PLUGIN_ID)}
        >
          {t("在标签页中编辑")}
        </button>
      </div>

      {menu && (
        <ContextMenu
          menuId="my-cool-plugin.noteContext"
          anchor={{ x: menu.x, y: menu.y }}
          context={{ noteId: menu.noteId }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
