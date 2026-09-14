/* eslint-disable linkdesk/no-hardcoded-hex -- 内容画布：便签纸底色/纸上的墨色属于内容世界（纸就是黄的，不随主题反转），非 UI chrome；按 05-插件UI写法规约 §11.2 整文件豁免 */
/**
 * 便签板——数据模型 + 常量 + 纯函数（两个表面共用）。
 *
 * ⚠️ 这里只放「类型 + 常量 + 纯函数」，**绝不放模块级可变状态**。
 * SDK 构建时每个表面（index.bundle.js / views/NotesView.bundle.js）是一次**独立 lib build**，
 * 共享模块在表面间各自打包一份（见 @linkdesk/plugin-sdk vite-config 的构建裁决）。
 * 模块级 state 会变成两份互不相通的副本——侧栏点了、标签页看不见。
 * 跨表面共享状态**一律**走 `window.linkdesk.pluginState` 单键 `board` + onChange 广播
 * （E5#84f 跨 WebView 状态同步原语）——见 useBoard.ts。
 */

/**
 * 插件 id——寻址 / 安装目录 / 命令前缀 / pluginState 归属键都用它。
 *
 * ⚠️ 本工程**故意没给 notifications.show 传 `source`**：壳（仓库 dev 版）支持这个归属键
 * （通知面板按来源分组、每组常驻各 5 条配额），但 npm 货架上 `@linkdesk/contracts@0.1.3`
 * 的 linkdesk.d.ts 还没有这个字段 → tsc 直接报「'source' does not exist」。
 * 货架包一补齐就能加回来（缺的是发布产物，不是壳能力）。
 */
export const PLUGIN_ID = "my-cool-plugin";

/** pluginState 单键——整块板子一个键：一次写入 = 一次广播 = 两侧表面同时收敛 */
export const BOARD_KEY = "board";

export interface Note {
  id: string;
  title: string;
  body: string;
  /** 便签纸底色（hex） */
  color: string;
  /** 优先级 0–100 */
  priority: number;
  done: boolean;
  updatedAt: number;
}

export interface Board {
  notes: Note[];
  /** 当前选中的便签——放进同一个键里，选中的切换也走同一次广播 */
  activeNoteId: string | null;
}

export const EMPTY_BOARD: Board = { notes: [], activeNoteId: null };

export const PRIORITY_MIN = 0;
export const PRIORITY_MAX = 100;
export const DEFAULT_PRIORITY = 50;

/** 便签纸预设色板——ColorPicker 的 presets 与新建便签的默认色源地 */
export const NOTE_COLOR_PRESETS: readonly string[] = [
  "#F2C14E",
  "#5FD3A6",
  "#5AA9E6",
  "#F28C9C",
  "#A78BFA",
  "#F09A5B",
];

export const DEFAULT_NOTE_COLOR = "#F2C14E";

/** 便签纸上的字——深墨色压在浅纸上（同理：内容级配色，不随主题反转） */
export const NOTE_INK = "#241E12";

export const UNTITLED = "（无标题）";

/** 新建便签——id 走时间戳 + 随机尾，插件域内自足，不需要壳发号 */
export function createNote(priority: number = DEFAULT_PRIORITY, color: string = DEFAULT_NOTE_COLOR): Note {
  return {
    id: `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    body: "",
    color,
    priority: clampPriority(priority),
    done: false,
    updatedAt: Date.now(),
  };
}

export function clampPriority(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PRIORITY;
  return Math.min(PRIORITY_MAX, Math.max(PRIORITY_MIN, Math.round(n)));
}

/** 盘上数据防御性归一——手改 / 版本漂移的坏数据不炸 UI，逐字段兜底 */
export function normalizeBoard(raw: unknown): Board {
  if (!raw || typeof raw !== "object") return EMPTY_BOARD;
  const r = raw as { notes?: unknown; activeNoteId?: unknown };
  const notes = Array.isArray(r.notes)
    ? r.notes.map(normalizeNote).filter((n): n is Note => n !== null)
    : [];
  const activeNoteId =
    typeof r.activeNoteId === "string" && notes.some((n) => n.id === r.activeNoteId)
      ? r.activeNoteId
      : (notes[0]?.id ?? null);
  return { notes, activeNoteId };
}

function normalizeNote(raw: unknown): Note | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  return {
    id: r.id,
    title: typeof r.title === "string" ? r.title : "",
    body: typeof r.body === "string" ? r.body : "",
    color: typeof r.color === "string" && r.color ? r.color : DEFAULT_NOTE_COLOR,
    priority: typeof r.priority === "number" ? clampPriority(r.priority) : DEFAULT_PRIORITY,
    done: r.done === true,
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now(),
  };
}

export function isPinned(note: Note, pinnedTitles: readonly string[]): boolean {
  const title = note.title.trim();
  return title !== "" && pinnedTitles.includes(title);
}

/** 列表排序方式——置顶 / 未完成永远在前，这个只决定同组内的次序 */
export type SortMode = "priority" | "recent";

/** 列表排序：置顶 → 未完成 →（按 sortMode）优先级高 / 最近更新（纯函数，视图层直接用） */
export function sortNotes(
  notes: readonly Note[],
  pinnedTitles: readonly string[],
  by: SortMode = "priority",
): Note[] {
  return [...notes].sort((a, b) => {
    const pa = isPinned(a, pinnedTitles) ? 0 : 1;
    const pb = isPinned(b, pinnedTitles) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (by === "priority" && a.priority !== b.priority) return b.priority - a.priority;
    return b.updatedAt - a.updatedAt;
  });
}

/** 列表摘要——正文第一行非空文字 */
export function noteSnippet(body: string): string {
  const line = body.split("\n").find((l) => l.trim());
  return line ? line.trim() : "";
}

export function noteTitleOf(note: Note): string {
  return note.title.trim() || UNTITLED;
}

/** 单条便签 → Markdown（导出用） */
export function noteToMarkdown(note: Note): string {
  const head = `- [${note.done ? "x" : " "}] ${noteTitleOf(note)}`;
  const body = note.body.trim();
  return body ? `${head}\n\n${body}\n` : `${head}\n`;
}

/** 整块板子 → Markdown（剪贴板导出用） */
export function boardToMarkdown(board: Board, pinnedTitles: readonly string[]): string {
  const ordered = sortNotes(board.notes, pinnedTitles, "recent");
  if (ordered.length === 0) return "";
  return `# 便签板\n\n${ordered.map(noteToMarkdown).join("\n")}`;
}
