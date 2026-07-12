# LogView - Windows 桌面端日志分析工具实现计划

## Context

用户希望开发一个类似 Gritlog 的 Windows 桌面日志分析工具。Gritlog 是一个基于 Web 的闭源日志分析器（Monaco Editor + 大文件分页 + Web Worker Grep）。本计划实现其增强版桌面端，技术选型为 Electron + React + Monaco Editor + TypeScript。

## 技术栈

- **桌面框架**: Electron (sandbox + contextIsolation)
- **前端**: React 18 + TypeScript + Zustand
- **编辑器**: Monaco Editor (VS Code 内核)
- **构建**: electron-vite
- **打包**: electron-builder (Windows NSIS)
- **编码检测**: jschardet + iconv-lite
- **文件监听**: chokidar
- **全文件搜索**: 内置 ripgrep 二进制

## 核心架构

```
Main Process (Node.js)          Renderer Process (React)        Web Workers
┌──────────────────────┐       ┌──────────────────────┐       ┌──────────────┐
│ file-service.ts      │◄─────►│ LogEditor.tsx        │       │ grep.worker   │
│ line-indexer.ts      │  IPC  │ SearchPanel.tsx      │◄─────►│ timeline.worker│
│ encoding-service.ts  │       │ TabBar.tsx           │       └──────────────┘
│ file-watcher.ts      │       │ TimelineView.tsx     │
│ export-service.ts    │       │ BookmarkPanel.tsx    │
│ config-store.ts      │       │ stores/ (Zustand)    │
└──────────────────────┘       └──────────────────────┘
        ▲                              ▲
        │        Preload (Bridge)       │
        └──── contextBridge API ────────┘
```

## 项目结构

```
log-server/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 入口，BrowserWindow，生命周期
│   │   ├── ipc-handlers.ts      # ipcMain.handle 注册
│   │   ├── file-service.ts      # 文件 I/O：打开、分页读取
│   │   ├── line-indexer.ts      # 字节偏移行索引（大文件核心）
│   │   ├── encoding-service.ts  # jschardet 检测 + iconv-lite 解码
│   │   ├── file-watcher.ts      # chokidar tail -f 实现
│   │   ├── export-service.ts    # 导出过滤结果到文件
│   │   └── config-store.ts      # electron-store 应用设置
│   ├── preload/
│   │   ├── index.ts             # contextBridge.exposeInMainWorld
│   │   └── api.d.ts             # 暴露 API 类型定义
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx         # React 入口 + Monaco 环境配置
│   │       ├── App.tsx          # 根组件
│   │       ├── components/
│   │       │   ├── Layout/      # AppLayout, Sidebar, StatusBar
│   │       │   ├── TabBar/      # TabBar, Tab
│   │       │   ├── Editor/      # LogEditor, EditorToolbar, MonacoSetup
│   │       │   ├── Search/      # SearchPanel, AdvancedGrepPanel, SearchResultList
│   │       │   ├── Timeline/    # TimelineView
│   │       │   ├── Bookmarks/   # BookmarkPanel
│   │       │   ├── ColoringRules/ # ColoringRuleEditor
│   │       │   └── Dialogs/     # GoToLine, Encoding, Export
│   │       ├── workers/         # grep.worker.ts, timeline.worker.ts
│   │       ├── hooks/           # useFilePager, useSearch, useBookmarks, useColoringRules, useTimeline, useTailMode, useMonacoDecorations, useGrepWorker
│   │       ├── stores/          # file-store, search-store, settings-store, ui-store (Zustand)
│   │       ├── services/        # paging-engine, ipc-client, grep-cache, color-rule-engine
│   │       ├── types/           # file, search, coloring, timeline, bookmarks, ipc
│   │       └── styles/          # global.css, variables.css, monaco-overrides.css
│   └── shared/                  # 主进程/渲染进程共享
│       ├── types.ts
│       ├── constants.ts
│       └── ipc-channels.ts
├── electron.vite.config.ts
├── electron-builder.yml
├── tsconfig.json / tsconfig.node.json / tsconfig.web.json
└── package.json
```

## 关键技术方案

### 1. 大文件分页引擎
- **行索引**: 扫描文件记录每行的字节偏移量，存为 `BigUint64Array`
- **渐进索引**: 先同步索引前 100K 行（即时显示），后台继续索引
- **分页**: 每页 2000 行，通过行索引 O(1) 定位到任意行
- **预取**: 距页面边界 200 行时预取下一页，LRU 缓存 5 页/文件
- **Monaco 集成**: 翻页时替换 model 内容，用 `lineNumbers` 函数显示真实行号

### 2. Grep 搜索
- **当前页搜索**: Web Worker 中执行正则匹配，不阻塞 UI
- **全文件搜索**: 小文件用 Node.js readline 流式匹配；大文件 spawn ripgrep
- **搜索缓存**: `Map<string, GrepResult>` 按 `file:pattern:options` 键缓存

### 3. Tail -f 模式
- chokidar 监听文件变化，记录 lastKnownSize
- 文件增长时读取增量内容，解码后追加到 Monaco model
- 检测日志轮转（文件缩小），重置索引

### 4. 着色规则
- 用户定义 `{regex, bgColor, fgColor, scope}` 规则
- 每次翻页时评估规则，生成 Monaco decorations 高亮

### 5. 时间线视图
- Web Worker 解析时间戳（ISO 8601, syslog, Apache 等格式）
- Canvas/SVG 渲染可视化时间线，点击跳转到对应行

## 实现阶段

| 阶段 | 内容 | 预估时间 |
|------|------|---------|
| **Phase 1** | 项目骨架 + 文件打开 + Monaco 显示 | 最先完成 |
| **Phase 2** | 行索引 + 分页引擎（核心难点） | 关键路径 |
| **Phase 3** | 搜索 + Grep Worker | 核心功能 |
| **Phase 4** | 多文件标签页 | 并行体验 |
| **Phase 5** | 编码检测 + 跳转到行 | 基础功能 |
| **Phase 6** | Tail -f 实时追踪 | 增强功能 |
| **Phase 7** | 着色规则 | 增强功能 |
| **Phase 8** | 时间线视图 | 增强功能 |
| **Phase 9** | 书签 | 增强功能 |
| **Phase 10** | 导出 + 打磨 + 性能优化 | 收尾 |

## 验证方式

1. **Phase 1**: 打开任意 .log 文件，内容正确显示在 Monaco Editor 中
2. **Phase 2**: 打开 2GB 日志文件，翻页流畅，内存占用稳定
3. **Phase 3**: 搜索关键字，结果高亮，点击跳转
4. **Phase 4**: 同时打开多个文件，标签切换正常
5. **Phase 5**: 打开 GBK 编码文件显示正确，Ctrl+G 跳转
6. **Phase 6**: 开启 tail 模式，新日志实时追加显示
7. **Phase 7**: 添加 "ERROR.*" 红色高亮规则，匹配行着色
8. **Phase 8**: 时间线图显示，点击跳转
9. **Phase 9**: Ctrl+F2 添加书签，书签面板导航
10. **Phase 10**: 导出搜索结果到文件，打包安装程序
