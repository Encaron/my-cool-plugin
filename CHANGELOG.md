# 更新日志

## v0.1.3（2026-09-15）

- 补 **MIT LICENSE** 并随包分发 —— 本仓此前没有许可证文件；MIT 要求「副本里带声明」，而 zip 才是用户真正拿到的那份。版权行与另外 19 只仓一致（`Copyright (c) 2026 Encaron`）
- 无功能变化：便签板一行没改

## v0.1.2（2026-09-15）

- 补 **市场身份图（Type-2 彩色身份图）** `resources/icon-brand.svg`，并在 `plugin.json` 用 `marketIcon` 声明 —— 本插件是**图标栏插件**：`icon`（`resources/icon.svg`）是 24×24 `currentColor` 线稿，按三图模型那是 **Type-1（只给图标栏）**；市场侧栏行 / 详情顶要的 Type-2 一直缺着，于是市场里显的是**统一默认彩块**
- 意象「一叠便签」：两张错位的便签纸（后纸只沿左上露一道边）+ 前纸右下折角 + 三行手写行；金 → 琥珀渐变底，与官方插件同一套家族 DNA（135° 双档渐变 + 白玻璃罩 + 发丝光边）
- `@linkdesk/plugin-sdk` 升到 0.1.19（^0.1.6 → ^0.1.19）——0.1.16 之前的 `publish` 没有 E6#106 的**身份图 URL 化**：包内相对路径写进目录条目后，**未装用户看到的图标恒 404**；同版还把打包排除表补齐（不再把 `marketplace.json` / `scripts/ci-verify.mjs` 这类仓库面文件装进 zip）
- 无功能变化：便签板本身一行没改

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
