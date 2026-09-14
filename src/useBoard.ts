/**
 * 便签板状态钩子——两个表面各挂一份，状态经 pluginState 汇聚。
 *
 * 数据流（单一真相源，无第二份）：
 *   写入方 commit() → window.linkdesk.pluginState.set(PLUGIN_ID, "board", next)
 *       → 壳 PluginStateService 落盘 + events.emit("plugin-state:changed")
 *       → 广播回**所有** WebView（E5#84f）→ 两侧表面的 onChange 同时收敛
 *
 * 乐观更新：本地先 setState 再写盘（点一下立刻有反馈），随后广播回来是同值幂等。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BOARD_KEY,
  PLUGIN_ID,
  clampPriority,
  createNote,
  normalizeBoard,
  type Board,
  type Note,
} from "./board";

export interface BoardApi {
  board: Board;
  /** 首次读盘完成——未完成前别写盘，否则会用空板覆盖盘上的数据 */
  ready: boolean;
  activeNote: Note | null;
  addNote(priority?: number, color?: string): string;
  updateNote(id: string, patch: Partial<Note>): void;
  removeNote(id: string): void;
  /** 清理已完成——返回清掉的条数 */
  clearDone(): number;
  setActive(id: string | null): void;
}

/** 配置项键——与 plugin.json contributes.configuration 一一对应 */
export const CONFIG_DEFAULT_PRIORITY = `${PLUGIN_ID}.defaultPriority`;
export const CONFIG_HIDE_COMPLETED = `${PLUGIN_ID}.hideCompleted`;
export const CONFIG_PINNED_TITLES = `${PLUGIN_ID}.pinnedTitles`;

export function useBoard(): BoardApi {
  const [board, setBoard] = useState<Board>(() => normalizeBoard(null));
  const [ready, setReady] = useState(false);

  // 最新板子的 ref——命令 handler / 写盘路径都要「当前值」，不能闭包捕获旧 state
  // （[[react-stale-closure-setstate-invoke]]：命令注册只跑一次，闭包里看到的永远是首帧）
  const boardRef = useRef<Board>(board);

  const apply = useCallback((next: Board) => {
    boardRef.current = next;
    setBoard(next);
  }, []);

  const commit = useCallback(
    (mutate: (prev: Board) => Board) => {
      const next = mutate(boardRef.current);
      apply(next); // 乐观更新——UI 立刻响应
      void window.linkdesk.pluginState.set(PLUGIN_ID, BOARD_KEY, next);
    },
    [apply],
  );

  useEffect(() => {
    let alive = true;
    void window.linkdesk.pluginState.get<Board>(PLUGIN_ID, BOARD_KEY).then((raw) => {
      if (!alive) return;
      apply(normalizeBoard(raw));
      setReady(true);
    });
    // 订阅广播——另一侧表面（或另一个窗口）写盘时本侧跟着收敛，返回 unsubscribe 供 unmount 清理
    const off = window.linkdesk.pluginState.onChange(PLUGIN_ID, BOARD_KEY, (value) => {
      apply(normalizeBoard(value));
    });
    return () => {
      alive = false;
      off();
    };
  }, [apply]);

  const addNote = useCallback(
    (priority?: number, color?: string) => {
      const note = createNote(priority, color);
      commit((prev) => ({ notes: [note, ...prev.notes], activeNoteId: note.id }));
      return note.id;
    },
    [commit],
  );

  const updateNote = useCallback(
    (id: string, patch: Partial<Note>) => {
      commit((prev) => ({
        ...prev,
        notes: prev.notes.map((n) =>
          n.id === id
            ? {
                ...n,
                ...patch,
                priority: patch.priority === undefined ? n.priority : clampPriority(patch.priority),
                updatedAt: Date.now(),
              }
            : n,
        ),
      }));
    },
    [commit],
  );

  const removeNote = useCallback(
    (id: string) => {
      commit((prev) => {
        const notes = prev.notes.filter((n) => n.id !== id);
        return {
          notes,
          activeNoteId: prev.activeNoteId === id ? (notes[0]?.id ?? null) : prev.activeNoteId,
        };
      });
    },
    [commit],
  );

  const clearDone = useCallback(() => {
    const removed = boardRef.current.notes.filter((n) => n.done);
    if (removed.length === 0) return 0;
    const removedIds = new Set(removed.map((n) => n.id));
    commit((prev) => {
      const notes = prev.notes.filter((n) => !n.done);
      return {
        notes,
        activeNoteId:
          prev.activeNoteId && removedIds.has(prev.activeNoteId)
            ? (notes[0]?.id ?? null)
            : prev.activeNoteId,
      };
    });
    return removed.length;
  }, [commit]);

  const setActive = useCallback(
    (id: string | null) => {
      commit((prev) => (prev.activeNoteId === id ? prev : { ...prev, activeNoteId: id }));
    },
    [commit],
  );

  const activeNote = board.notes.find((n) => n.id === board.activeNoteId) ?? null;

  return { board, ready, activeNote, addNote, updateNote, removeNote, clearDone, setActive };
}

/** 读一个配置值 + 订阅变更（配置是运行时动态值，读一次会在用户改设置后脱节——必须订阅） */
export function useConfig<T>(key: string, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    let alive = true;
    void window.linkdesk.configuration.get<T>(key).then((v) => {
      if (alive && v !== undefined && v !== null) setValue(v);
    });
    const off = window.linkdesk.configuration.onChange<T>(key, (v) => {
      if (v !== undefined && v !== null) setValue(v);
    });
    return () => {
      alive = false;
      off();
    };
  }, [key]);
  return value;
}
