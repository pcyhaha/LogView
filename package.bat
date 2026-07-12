@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 切到 bat 所在目录，确保从任意位置双击都能正确启动
cd /d "%~dp0"

:: 使用国内 CDN 镜像，避免从 GitHub 下载 winCodeSign 等二进制失败
:: （注意：必须用 cdn.npmmirror.com 直连，registry.npmmirror.com 会 302 跳转导致 electron-builder 下载器失败）
set ELECTRON_BUILDER_BINARIES_MIRROR=https://cdn.npmmirror.com/binaries/electron-builder-binaries/
:: 降低 7z 压缩级别，避免打包 170MB 应用时 7za 用最高压缩级别导致极慢且占内存
set ELECTRON_BUILDER_COMPRESSION_LEVEL=1

::: 打包日志统一输出到 log/ 目录
if not exist log mkdir log

echo ========================================
echo   LogView 打包中 (portable 绿色版)...
echo   目录: %CD%
echo ========================================
echo.

:: 先编译，再交给 electron-builder 打包成单文件 exe
call npm run package > log\package.log 2>&1

if errorlevel 1 (
    echo.
    echo [错误] 打包失败，请确认：
    echo   1. 已安装 Node.js 且版本 >= 18
    echo   2. 已执行过 npm install
    echo   3. node_modules\electron\dist\electron.exe 存在
    echo   详细日志：log\package.log
    echo.
    pause
) else (
    echo.
    echo [完成] 产物在 dist\ 目录下（LogView-1.0.0-portable.exe）
    echo   打包日志：log\package.log
    echo.
    pause
)

endlocal
