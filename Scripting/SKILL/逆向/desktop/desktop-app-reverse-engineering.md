# 桌面应用逆向工程
## Step 1: 识别应用框架
| 框架 | 识别特征 |
|------|---------|
| Electron | Frameworks/Electron Framework, *.asar |
| Wails | Built using Wails in Info.plist |
| Tauri | libtauri*, Rust 字符串 |
## Step 7: FAT Binary 双 Slice
macOS Universal Binary 包含多个架构 slice，每个 slice 都有一份完整的 JS/字符串副本。
## Step 8: 二进制原地字符串替换
当前端 JS 以明文嵌入二进制时，原地替换是最可靠的解锁方式。
## Step 9: Zustand Store 验证路径全覆盖
四种 isPro 调用路径：Store定义、Zustand Selector、快捷函数、直接调用。
