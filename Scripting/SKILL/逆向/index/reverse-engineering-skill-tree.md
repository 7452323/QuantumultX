# 逆向工程技能树

逆向工程 = 从编译产物还原逻辑。覆盖从Web JS到Native SO、从二进制到协议的全栈逆向场景。

## 子领域索引

### 1. AI驱动逆向
| Skill | 用途 |
|-------|------|
| ida-reverse-analysis | IDA Pro + Ghidra + GhidraMCP |

### 2. JS逆向核心
| Skill | 用途 |
|-------|------|
| camoufox-workflow | JS逆向6阶段全流程 |
| jsvmp-reverse | JS VM虚拟机逆向 |
| find-crypto-entry | 加密参数入口定位 |
| env-patch | JS补环境 |
| ast-deobfuscation | Babel AST反混淆 |
| algorithm-reverse | 签名/混合加密还原 |
| anti-debug | JS反调试对抗 |

### 3. 反调试对抗
| Skill | 用途 |
|-------|------|
| anti-debug | JS反调试 + 二进制级反调试 |

### 4. 桌面/移动端逆向
| Skill | 用途 |
|-------|------|
| desktop-app-reverse-engineering | 桌面应用逆向 |
| android-reverse-engineering | Android APK反编译/Frida |
| ida-reverse-analysis | IDA Pro/Ghidra二进制分析 |

### 5. Web API协议逆向
| Skill | 用途 |
|-------|------|
| camoufox-workflow | JS逆向+CF绕过 |
| web-api-protocol-reverse | ChatGPT/OpenAI协议逆向 |
| har-to-proxy-script | HAR→代理脚本 |
| cross-platform-proxy-scripting | 跨平台代理脚本 |

### 6. Cloudflare绕过策略
| 防护等级 | 绕过方案 | 实测结果 |
|----------|----------|----------|
| L0 无防护 | 任意HTTP库 | ✅ |
| L1 IUAM | cloudscraper/FlareSolverr | ✅ |
| L2 JS Challenge | FlareSolverr/Playwright+stealth | ✅ |
| L3 Turnstile+JS Challenge | 需住宅代理 | ❌无住宅代理不可破 |
| L4 WAF+Turnstile+指纹 | 商业方案 | ❌ |

### 7. 代码混淆/反混淆
| Skill | 用途 |
|-------|------|
| deobfuscator | jsjiami/sojson/obfuscator.io一键还原 |
| code-obfuscation-deobfuscation | 混淆类型分析 |
| ast-deobfuscation | Babel AST反混淆 |

### 8. 其他逆向
| Skill | 用途 |
|-------|------|
| binary-diffing | 二进制对比 |
| book-source-master | Legado书源编写 |
| qx-script-master | QX/Surge脚本 |
| pyinstaller-reverse | PyInstaller解包+反编译 |

## 典型工作流
- Web JS逆向: anti-debug -> find-crypto-entry -> env-patch -> ast-deobfuscation -> algorithm-reverse
- 桌面App逆向: desktop-app-reverse -> 识别技术栈 -> 提取资源 -> 分析认证逻辑
- PyInstaller逆向: strings识别 -> pyinstxtractor解包 -> pycdc反编译 -> 提取API key
