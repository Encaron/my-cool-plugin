# 更新日志

## v0.1.1（2026-09-14）

- ⌨ **新增双段（chord）快捷键 `Ctrl+K Ctrl+Q`** —— 命令 `my-cool-plugin.quickNote`「快捷新建便签」：
  在任意位置按两段键，直接开一个便签板标签页并新建一条便签，同时发一条带 ⌨ 前缀的回执通知
  （让「按了快捷键」与「点了按钮」肉眼可分）
- 命令 handler 改为**两个表面各注册一次**（侧栏视图 / 主区标签页，同 id 幂等覆盖）——
  此前命令只在侧栏挂载时存在，侧栏收起时按键会命中一个没注册的命令 = 死键
- 🔴 键位为什么是这一个：壳的 `normalizeKey()` 对**整串**按 `+` 切分再排序，双段串会被打乱。
  实测只有 `ctrl+k ctrl+<字母≥k>` 这一形状能原样存活（`ctrl+k ctrl+h` 会变成 `ctrl+h+k ctrl`、
  `ctrl+k ctrl+shift+p` 会变成 `ctrl+shift+k ctrl+p`，注册键位与按下键位对不上 ⇒ **静默死键**）。
  这是壳侧 `normalizeKey` 的真缺陷，本版用「挑一个能活下来的键位」绕过；缺陷本身另行登记。
- 版本号同源对齐：`plugin.json` 与 `package.json` 均为 `0.1.1`（N6 第 ④ 处锚）

## v0.1.0（2026-09-11）

- 首版：便签板双表面插件——侧栏列表（搜索 / 重命名 / 右键菜单）+ 主区标签页（便签墙 + 编辑器）
- 覆盖的接入点：`appearsIn`（iconBar / sidePanel / tabBar）、`contributes.viewsContainers` /
  `views`（含 `titleActions`）、`commands`×5、`menus`（插件自有右键槽位）、`configuration`（3 项，
  含 `uiHint: stringList`）、`i18n`
- 状态经 `window.linkdesk.pluginState` 单键 `board` 汇聚，两侧表面经广播收敛（无第二份真相源）
