---
name: 快捷指令
description: 创建、签名、验证 iOS 快捷指令 (.shortcut)。通过 HubSign API 将 plist 转为 Apple CMS 签名文件，确保 iOS 17 兼容不闪退。Intent patterns: 快捷指令,shortcut,sign,签名,plist,AEA1,HubSign,创建快捷指令,导入快捷指令
metadata:
  display_name: "快捷指令签名"
  intent_patterns: "快捷指令,shortcut,sign,签名,plist,AEA1,HubSign,创建快捷指令,导入快捷指令"
  required_tools: "run_shell_command,file_tool"
---

# Purpose

通过 HubSign API 创建、签名 iOS 快捷指令 (.shortcut) 文件。确保 iOS 17 兼容（showresult 格式安全），签名结果可直接导入 Shortcuts App。

# Instructions

## 快速签名流程

1. 构建快捷指令 plist dict（Python 格式）
2. 运行签名脚本：`python3 <skill_dir>/scripts/sign.py --name "快捷指令名" --output "output.shortcut"`
3. 签名脚本自动完成：构建 plist → 序列化 XML → POST HubSign API → 验证 AEA1 → 保存文件

## 关键避雷

### User-Agent 必须是 `cherri/1.0`
Cloudflare 白名单，其他 UA 返回 HTML 挑战页（200 状态码但 body 是 HTML）

### showresult Text 必须用直接字符串
```python
# ❌ 错误 - iOS 17 闪退
"Text": {"Value": {"attachmentsByRange": {}, "string": {"string": "..."}}, "WFSerializationType": "WFTextTokenString"}

# ✅ 正确 - iOS 17 正常
"Text": "直接字符串"
```

### Headers 必须完整
```python
{
    "Content-Type": "application/json",
    "Origin": "https://routinehub.co",
    "Referer": "https://routinehub.co/",
    "User-Agent": "cherri/1.0",
}
```

# Scripts

## `scripts/sign.py`

完整签名脚本，接受参数：
- `--name` / `-n`: 快捷指令名称
- `--output` / `-o`: 输出文件路径（默认 `signed.shortcut`）
- `--actions`: actions JSON 文件路径（可选）

示例：
```bash
python3 <skill_dir>/scripts/sign.py --name "MyShortcut" --output "my_shortcut.shortcut"
```

脚本内置一个默认 demo 快捷指令（显示文本 → 复制剪贴板 → 通知 → 弹窗 → 打开 URL），5 个动作全部用安全格式。

# Specs

- **API**: `POST https://hubsign.routinehub.services/sign`
- **请求体**: `{"shortcutName": "名称", "shortcut": "<XML plist>"}`
- **成功响应**: 二进制，前 4 字节 `AEA1`
- **CA 链**: Apple System Integration CA 4 → Apple Certification Authority → Apple Inc.
- **兼容性**: iOS 13+（最低客户端版本 900）
- **动作数量**: < 50 个
- **超时**: 30s
