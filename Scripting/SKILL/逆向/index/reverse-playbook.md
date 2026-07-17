# Reverse Playbook — 通用逆向实战框架

> 从实战中提炼，为实战服务。所有模式均来自真实逆向案例。

## 7大通用逆向模式

| # | 模式 | 解决的问题 | 实战来源 |
|---|------|-----------|---------|
| 1 | 私有协议逆向 | 目标使用私有API协议、AES加密、自定义签名 | ONE App / chatgpt2api |
| 2 | 桌面应用注入 | macOS WKWebView / Wails CDP逆向 | HttpCall |
| 3 | Web工具站批量提取 | tools.miku.ac等工具站所有工具归档 | tools.miku.ac |
| 4 | PyInstaller拆包 | 打包成单文件的Python应用逆向 | PyInstaller实战 |
| 5 | Flutter App逆向 | Flutter libapp.so反编译+Key提取 | ONE App |
| 6 | CDN加密图片破解 | 服务端返回加密文件，客户端解密显示 | ONE App |
| 7 | Anti-anti-automation | WAF/PoW/Turnstile/签名/Token绕过 | chatgpt2api / ONE |

## 模式1：私有协议逆向
1. 确定技术栈（Flutter/原生/Web/Wails）
2. 找到加密常量存储位置
3. 提取Key/IV/Salt -> 试解已知响应
4. 找到签名算法 -> HAR验证
5. 找到无Token入口点

## 模式2：桌面应用注入
发现是Wails -> strings提取嵌入前端资源
发现是macOS WKWebView -> DYLD注入dylib -> hook WKWebView -> 注入fetch劫持JS -> 伪造Pro订阅

## 模式7：Anti-anti-automation三层防御
WAF层 -> 签名验证层 -> Token/IP绑定层

## 快速启动模板
```
技术栈识别 -> 工具选择 -> 常量提取 -> 签名破解 -> 入口点发现 -> 管道打通 -> 自动化
```
