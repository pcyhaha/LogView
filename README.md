# LogView

专业的 Windows 桌面端日志分析工具

基于 **Electron + React + Monaco Editor**，专为查看和分析大体积日志文件而设计，支持大文件分页、实时追踪（tail）、全文/当前页搜索、着色规则、时间线、书签等能力。

> 产品名 `LogView` 保留原文，界面文案已全面中文化。

---

## ✨ 功能特性

- **大文件分页引擎**：通过字节偏移行索引（渐进式建立）实现超大日志（GB 级）流畅翻阅，默认每页 2000 行，状态栏显示「索引中…」。
- **多种编码自动识别**：基于 `jschardet` + `iconv-lite` 自动检测 GBK / UTF-8 / 其他编码并正确解码显示。
- **搜索**
  - 当前页搜索（默认，零文件 IO，毫秒级，支持正则 / 区分大小写 / 整词）。
  - 整个文件搜索（流式扫全文件）。
  - 上一个 / 下一个结果跳转（F3 / Shift+F3）。
- **实时追踪（Tail -f）**：监听文件增量，新日志自动追加显示，自动检测日志轮转。
- **着色规则**：自定义正则规则，对匹配行进行前景 / 背景高亮（如把 `ERROR` 行标红）。
- **时间线视图**：解析时间戳（ISO 8601、syslog、Apache 等）并可视化，点击可跳转到对应行。
- **书签**：在任意行添加 / 移除书签，通过书签面板快速导航（Ctrl+F2）。
- **多文件标签页**：同时打开多个日志文件，标签切换互不干扰。
- **跳转到行**：按行号快速定位（Ctrl+G）。
- **导出**：将搜索 / 过滤结果导出到文件。
- **纯绿色版**：单文件免安装，双击即用，设置数据保存在 exe 同级目录，整体拷贝即可迁移。

---

## 🧰 技术栈

| 类别 | 选型 |
| --- | --- |
| 桌面框架 | Electron 30（sandbox + contextIsolation） |
| 前端 | React 18 + TypeScript + Zustand |
| 编辑器 | Monaco Editor（VS Code 内核） |
| 构建 | electron-vite |
| 打包 | electron-builder（Windows portable / NSIS） |
| 编码检测 | jschardet + iconv-lite |
| 文件监听 | chokidar |

---

## 📋 环境要求

- **Node.js**：建议 18.x 或 20.x（与 Electron 30 兼容）
- **npm**：随 Node 安装
- **操作系统**：开发机为 Windows（当前打包目标为 Windows x64）

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

> 若从 GitHub 下载 Electron 二进制失败（报 `E_FAIL` / `Electron uninstall`），请先设置国内镜像再重试：
> ```bash
> set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
> node node_modules/electron/install.js
> ```

### 2. 开发运行

```bash
npm run dev
```

启动后支持 HMR 热更新；主进程文件改动会自动重建并重启。

### 3. 构建（仅编译，不打包）

```bash
npm run build
```

### 4. 打包为 Windows 绿色版（单文件免安装）

**方式一：双击 `package.bat`**（推荐，已内置国内镜像与压缩优化）。

**方式二：命令行**（整行一次性执行，注意 `&&` 前后无空格）：

```bat
set ELECTRON_BUILDER_BINARIES_MIRROR=https://cdn.npmmirror.com/binaries/electron-builder-binaries/&&set ELECTRON_BUILDER_COMPRESSION_LEVEL=1&&npm run package > log\package.log 2>&1
```

打包成功后，产物位于 `dist/logview-1.0.0-portable.exe`，双击即用。

> 详细的打包配置、镜像变量坑、离线兜底方案见 [`doc/运行与打包.md`](doc/运行与打包.md)。

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+O` | 打开日志文件 |
| `Ctrl+F` | 搜索 |
| `Ctrl+G` | 跳转行 |
| `Ctrl+F2` | 在当前行添加 / 移除书签 |
| `F3` / `Shift+F3` | 搜索：下一个 / 上一个结果 |
| `PageUp` / `PageDown` | 上一页 / 下一页 |
| `Ctrl+0` / `Ctrl++` / `Ctrl+-` | 重置 / 放大 / 缩小缩放 |
| `F11` | 切换全屏 |
| `F5` / `Ctrl+R` | 重新加载 |
| `F12` | 打开开发者工具 |
| `Esc` | 关闭当前侧栏或对话框 |

> 窗口级动作（重新加载、全屏、缩放、退出等）与文件对话框通过主进程 IPC 实现；菜单为渲染进程自绘（HTML/CSS），可自由调整字号。

---

## 📁 数据目录（绿色版）

程序设置（主题、页面大小、着色规则、最近文件等）由 `electron-store` 持久化：

- **开发模式（`npm run dev`）**：写入 `AppData\Roaming\LogView\logview-settings.json`，不污染项目目录。
- **绿色版正式运行**：写入 **exe 同级目录** 的 `logview-settings.json`。

因此把 exe 拷到任意可写目录（本地文件夹、U 盘等）双击即可运行，数据与 exe 同目录，整体拷贝 / 删除即可迁移或清理。

> ⚠️ 请将 exe 放在**可写目录**运行（不要放在 `C:\Program Files\` 等系统目录），否则设置无法保存。
> ⚠️ 若之前手动切换过主题，exe 同级的 `logview-settings.json` 会记录 `theme:dark`；如需恢复默认白色主题，删除该文件或其中 `theme` 字段即可。

---

## 📂 目录结构

```
logview/
├─ src/
│  ├─ main/            # 主进程：文件读取/编码/分页索引/搜索/tail/时间线/设置/IPC
│  ├─ preload/         # 预加载脚本（contextBridge 暴露 API）
│  ├─ shared/          # 主进程与渲染进程共享的常量、类型、IPC 通道
│  └─ renderer/        # 渲染进程：React + Zustand + Monaco
├─ out/                # 编译产物（由 build/dev 生成）
├─ dist/               # 打包产物（portable exe）
├─ log/                # 构建 / 打包 / 运行日志（由 .gitignore 忽略）
├─ test/               # 测试文件（脚本、mock、样例日志等）
├─ doc/                # 文档（运行与打包说明、实现计划）
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ package.bat
└─ package.json
```

---

## ❓ 常见问题

**Q：运行 `npm run dev` 报 `Error: Electron uninstall`？**
A：Electron 二进制未下载成功。设置 `ELECTRON_MIRROR` 镜像后重新执行 `node node_modules/electron/install.js`。

**Q：打包时报下载失败（404 / EBUSY）？**
A：下载失败多为镜像地址末尾空格导致（见 `doc/运行与打包.md` 的「镜像变量赋值坑」）；`EBUSY` 多为旧 exe 仍在运行占用 `dist/win-unpacked`，先 `taskkill /IM "logview-1.0.0-portable.exe" /F` 再打包。

**Q：打开大日志文件很慢？**
A：程序采用分页 + 字节偏移行索引，超大文件会先建立索引（状态栏显示「索引中…」），完成后可流畅翻阅。

**Q：界面是英文的？**
A：界面文案已中文化。Monaco 编辑器内置菜单由 Electron 按系统语言自动本地化。

---

## 📄 许可证

MIT
