---
name: ida-reverse-analysis
description: IDA Pro逆向分析技能。IDAPython脚本编写、加密算法识别、DLL导出分析、F5伪代码优化、二进制patch。
author: 7452323
tags: [ida, idapro, binary, reverse-engineering, idapython]
---

# IDA Reverse Analysis — IDA Pro逆向分析

## IDAPython 实用脚本

```python
# 列出所有函数
for ea in Functions():
    name = GetFunctionName(ea)
    print(f"0x{ea:x}: {name}")

# 获取函数伪代码
import ida_hexrays
if ida_hexrays.init_hexrays_plugin():
    cfunc = ida_hexrays.decompile(ea)
    print(str(cfunc))

# 搜索指定字节模式
pattern = "55 8B EC 83 EC ? ?"
results = ida_search.find_binary(ea, BADADDR, pattern, 16, SEARCH_DOWN)
```

## 加密算法识别

| 特征 | 算法 | 确认方法 |
|------|------|----------|
| 64x64常数表 | AES | 找 S-box 常量 |
| 64x64 盒 + 0x9E3779B9 | TEA/XTEA | delta 常量 |
| 0x6C078965 | MT19937 | 种子初始化 |
| 0x67452301+0xEFCDAB89 | MD5/SHA-1 | 初始 IV |
| 大整数运算+0x10001 | RSA | 公钥指数 |

## DLL 分析流程

1. 加载 DLL 到 IDA
2. 识别导出函数（View → Exports）
3. 分析每个导出函数的调用链
4. 标记系统/第三方 API 调用
5. 提取关键字符串和加密常量
