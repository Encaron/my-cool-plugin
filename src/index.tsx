/**
 * 便签板·主区标签页——便签墙 + 选中便签编辑器。
 *
 * 视图插件契约：壳以 { isActive, tabId?, sourceId? } 渲染本文件 default 导出的组件。
 *   - isActive  本标签当前是否聚焦。keep-alive 下非聚焦标签仍在渲染，isActive 只用于
 *               gate「聚焦才跑」的副作用，切勿用它整块 blank 掉内容。
 *   - 本插件不消费 tabId/sourceId（便签是插件自有数据，不对应文件 / 数据源）。
 *
 * 与侧栏的关系：两侧是**两个独立打包的表面**（SDK 每表面一次 lib build），状态经
 * pluginState 单键 board 汇聚——见 ../board.ts 头注释与 ../useBoard.ts。
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  ColorPicker,
  ContextMenu,
  FormRow,
  NumberInput,
  SegmentedRadio,
  Slider,
  Toggle,
} from "@linkdesk/ui";
import {
  NOTE_COLOR_PRESETS,
  NOTE_INK,
  PLUGIN_ID,
  PRIORITY_MAX,
  PRIORITY_MIN,
  boardToMarkdown,
  noteTitleOf,
  sortNotes,
  type Note,
  type SortMode,
} from "./board";
import { CONFIG_HIDE_COMPLETED, CONFIG_PINNED_TITLES, useBoard, useConfig } from "./useBoard";
import { useQuickNoteCommand } from "./useQuickNote";
import "./index.css";

export default function StickyBoardTab(_props: { isActive?: boolean; tabId?: string; sourceId?: string }) {
  const { t } = useTranslation();
  const boardApi = useBoard();
  const { board, ready, activeNote, addNote, updateNote, removeNote, clearDone, setActive } = boardApi;
  // ⌨ 双段快捷键命令——两个表面各注册一次（同 id 幂等覆盖）。只挂一个表面的话，
  //   另一个表面开着时按键会命中没注册的命令 = 死键。
  useQuickNoteCommand(boardApi);

  const hideCompleted = useConfig<boolean>(CONFIG_HIDE_COMPLETED, false);
  const pinnedTitles = useConfig<string[]>(CONFIG_PINNED_TITLES, []);

  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [pickerAnchor, setPickerAnchor] = useState<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; noteId: string } | null>(null);

  const cards = useMemo(
    () => sortNotes(board.notes, pinnedTitles, sortMode).filter((n) => !(hideCompleted && n.done)),
    [board.notes, pinnedTitles, sortMode, hideCompleted],
  );
  const doneCount = board.notes.filter((n) => n.done).length;

  const copyMarkdown = async () => {
    const md = boardToMarkdown(board, pinnedTitles);
    if (!md) {
      // 通知 ≠ 必须被看见的通道——这里只是「操作已完成」的回执，不需要用户当场决定
      await window.linkdesk.notifications.show(t("便签板是空的，没有可导出的内容"), { type: "info" });
      return;
    }
    await window.linkdesk.clipboard.writeText(md);
    await window.linkdesk.notifications.show(t("已复制 {{n}} 条便签到剪贴板", { n: board.notes.length }), {
      type: "info",
    });
  };

  const confirmRemove = (note: Note) => {
    void window.linkdesk.dialog.confirm(t("删除便签「{{title}}」？", { title: t(noteTitleOf(note)) })).then((ok) => {
      if (ok) removeNote(note.id);
    });
  };

  return (
    <div className="mcp-tab">
      <header className="mcp-tab__bar">
        <span className="mcp-tab__brand">{t("便签板")}</span>
        <span className="mcp-tab__stat">
          {t("{{total}} 条 · 已完成 {{done}}", { total: board.notes.length, done: doneCount })}
        </span>
        <span className="mcp-tab__spacer" />
        <SegmentedRadio
          ariaLabel={t("排序方式")}
          value={sortMode}
          onChange={(v) => setSortMode(v as SortMode)}
          options={[
            { value: "priority", label: t("按优先级") },
            { value: "recent", label: t("按最近更新") },
          ]}
        />
        <Button onClick={() => addNote()}>{t("＋ 新建便签")}</Button>
        <Button variant="ghost" disabled={doneCount === 0} onClick={() => void clearDone()}>
          {t("清理已完成")}
        </Button>
        <Button variant="ghost" onClick={() => void copyMarkdown()}>
          {t("复制为 Markdown")}
        </Button>
      </header>

      <div className="mcp-tab__body">
        <section className="mcp-board" aria-label={t("便签墙")}>
          {!ready ? (
            <div className="mcp-empty">{t("正在读取便签…")}</div>
          ) : cards.length === 0 ? (
            <div className="mcp-empty">{t("还没有便签——点右上角「＋ 新建便签」")}</div>
          ) : (
            <div className="mcp-board__grid">
              {cards.map((note) => (
                <button
                  type="button"
                  key={note.id}
                  className={`mcp-card${note.id === board.activeNoteId ? " is-active" : ""}`}
                  style={{ background: note.color, color: NOTE_INK }}
                  onClick={() => setActive(note.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, noteId: note.id });
                  }}
                >
                  <span className="mcp-card__head">
                    <span className={`mcp-card__title${note.done ? " is-done" : ""}`}>{t(noteTitleOf(note))}</span>
                    {note.priority >= 80 && <span className="mcp-card__pin">★</span>}
                  </span>
                  <span className="mcp-card__body">{note.body.trim() || t("（空）")}</span>
                  <span className="mcp-card__foot">
                    <span>{note.done ? t("已完成") : t("优先级 {{n}}", { n: note.priority })}</span>
                    <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="mcp-editor" aria-label={t("便签编辑器")}>
          {!activeNote ? (
            <div className="mcp-empty">{t("选中左侧任意便签开始编辑")}</div>
          ) : (
            <>
              <div className="mcp-editor__head">
                <span className="mcp-editor__dot" style={{ background: activeNote.color }} aria-hidden />
                <span className="mcp-editor__name">{t(noteTitleOf(activeNote))}</span>
                {activeNote.done && <Badge title={t("已完成")}>✓</Badge>}
              </div>

              <input
                className="mcp-input"
                value={activeNote.title}
                placeholder={t("便签标题")}
                spellCheck={false}
                onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
              />

              <textarea
                className="mcp-textarea"
                value={activeNote.body}
                placeholder={t("写点什么…支持 Markdown")}
                spellCheck={false}
                onChange={(e) => updateNote(activeNote.id, { body: e.target.value })}
              />

              <div className="mcp-editor__form">
                <FormRow label={t("底色")}>
                  <div className="mcp-swatches">
                    {NOTE_COLOR_PRESETS.map((hex) => (
                      <button
                        type="button"
                        key={hex}
                        className={`mcp-swatch${activeNote.color === hex ? " is-active" : ""}`}
                        style={{ background: hex }}
                        title={hex}
                        aria-label={hex}
                        onClick={() => updateNote(activeNote.id, { color: hex })}
                      />
                    ))}
                    <button
                      type="button"
                      className="mcp-swatch mcp-swatch--custom"
                      title={t("自定义颜色")}
                      aria-label={t("自定义颜色")}
                      onClick={(e) => setPickerAnchor({ x: e.clientX, y: e.clientY })}
                    />
                  </div>
                </FormRow>

                <FormRow label={t("优先级")}>
                  <div className="mcp-row">
                    <Slider
                      ariaLabel={t("优先级")}
                      value={activeNote.priority}
                      min={PRIORITY_MIN}
                      max={PRIORITY_MAX}
                      onChange={(v) => updateNote(activeNote.id, { priority: v })}
                    />
                    <NumberInput
                      value={activeNote.priority}
                      min={PRIORITY_MIN}
                      max={PRIORITY_MAX}
                      onChange={(v) => updateNote(activeNote.id, { priority: v })}
                      style={{ width: 72 }}
                    />
                  </div>
                </FormRow>

                <FormRow label={t("已完成")}>
                  <Toggle
                    checked={activeNote.done}
                    onChange={(v) => updateNote(activeNote.id, { done: v })}
                  />
                </FormRow>
              </div>

              <div className="mcp-editor__foot">
                <span className="mcp-editor__time">
                  {t("更新于 {{time}}", { time: new Date(activeNote.updatedAt).toLocaleString() })}
                </span>
                <Button variant="danger" onClick={() => confirmRemove(activeNote)}>
                  {t("删除")}
                </Button>
              </div>
            </>
          )}
        </aside>
      </div>

      <ColorPicker
        open={pickerAnchor !== null}
        value={activeNote?.color ?? NOTE_COLOR_PRESETS[0]}
        presets={[...NOTE_COLOR_PRESETS]}
        anchor={pickerAnchor}
        onChange={(hex) => {
          if (activeNote) updateNote(activeNote.id, { color: hex });
        }}
        onClose={() => setPickerAnchor(null)}
      />

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
