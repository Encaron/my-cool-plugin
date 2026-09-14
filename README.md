# My Cool Plugin（便签板）

LinkDesk 的**便签板**插件——侧栏列表 + 主区标签页双表面，用 `@linkdesk/ui` 控件与 `window.linkdesk.*` API 搭的便签应用。

这个插件同时是 LinkDesk 的**端到端验证样例**：它把插件系统的交互型接入点尽可能走一遍，
既是能用的便签板，也是「插件接入点是否通」的活体样本。

## 装它

在 LinkDesk 里打开**插件市场** → 「探索插件」段找到 **My Cool Plugin** → 安装。

也可以手动装：到 [Releases](../../releases) 下载 `my-cool-plugin.linkdesk-plugin`，
在市场详情页选「从本地文件安装」。

## 用它的快捷键

| 键 | 做什么 |
|:--|:--|
| ⌨ `Ctrl+K` 然后 `Ctrl+Q` | **快捷新建便签**——任意位置按两段键，开标签页并新建一条便签（2 秒内按完第二段；超时状态栏会提示） |

> 快捷键可以在**设置 → 快捷键**里改绑（双段键位在表格里显示为两段）。改绑后本表就不再准了。

## 它覆盖了哪些插件接入点

| 接入点 | 本插件怎么用 |
|:--|:--|
| `appearsIn` | `iconBar: "top"` + `sidePanel: true` + `tabBar: true` |
| `contributes.viewsContainers` / `views` | 侧栏容器 `my-cool-plugin-sidebar`，一个视图 `notes`，带 `titleActions`（新建 / 清理 / 在标签页打开） |
| `contributes.commands` | 6 条命令（新建 / 打开标签页 / 重命名 / 删除 / 清理已完成 / 快捷新建） |
| `contributes.keybindings` | ⌨ 双段键位 `ctrl+k ctrl+q` → `my-cool-plugin.quickNote` |
| `contributes.menus` | 插件自有右键槽位 `my-cool-plugin.noteContext`（便签卡片 / 列表项右键） |
| `contributes.configuration` | 3 项：`defaultPriority`（number）/ `hideCompleted`（boolean）/ `pinnedTitles`（array + `uiHint: stringList`） |
| `contributes.i18n` | `i18n/en.json`（key = 中文原文） |
| 状态与通知 | `pluginState` 单键 `board` 跨表面汇聚；通知只走唯一通知面（铃铛面板），不造浮层 |

## 开发

```bash
npm install
npm run dev        # 浏览器预览（dev-host，端口 1421）
npm run validate   # 校验 plugin.json + i18n 文件
npm run build      # 打包出 my-cool-plugin.linkdesk-plugin
npm run publish    # 发布到本仓 Release + 更新本仓根 marketplace.json
```

> ⚠️ **预览宿主（`npm run dev`）看不到**：图标栏图标、侧栏容器、右键菜单、**快捷键**——
> 纯浏览器宿主只渲染 `entry` 组件。要验这些必须在**真壳**里（装进 LinkDesk，
> 或用壳侧 dev：`linkdesk-plugin-sdk dev --real`）。
