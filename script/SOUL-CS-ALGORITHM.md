# Soul App 请求签名（cs / slb）逆向记录

逆向目标：Soul 客户端的 HTTP 签名头 `cs`，用于让脚本自行构造合法请求
（特别是 `/meet/uncover/list`「揭晓缘分」—— 访客列表接口只下发标签，身份字段全 null）。

样本集：用户抓包 `2026-09-23-072943.har`（712 请求，407 个带 cs，401 个唯一）。
二进制样本：`cn.soulapp.android` xapk → `lib/arm64-v8a/libsoulpower.so`。

## 一、cs 的形态

```
cs = 36 个 hex 字符，全字符集 0123456789abcdef
例: 02800b3ae2cfab06e1fb07b68e32884607b2
```

按字符位置的取值分布（401 样本统计）：

```
pos 0-3    CONST  0280
pos 4-5    16种   随机
pos 6-7    CONST  3a
pos 8-9    16种   随机
pos10-11   7种    {6f,7f,8f,9f,af,bf,cf}   ← 随请求时间单调递增
pos12-13   16种   随机
pos14-15   CONST  06
pos16-17   16种   随机
pos18-19   16种   (低 nibble 恒 b)
pos20-21   2种    {03,07}
pos22-23   2种    {b6,b7}
pos24-31   16种   随机 4 字节
pos32-33   CONST  07
pos34-35   CONST  b2
```

等价写法：`cs = "0280" + 32 hex`，其中 32 hex 含固定字符
`3a`@0-1 / `cf`@6-7 / `06`@10-11 / `07b6`@16-19 / `07b2`@28-31（相对 32 内偏移）。

## 二、cs 是确定性函数（关键结论）

同一 `at` 头 + 同一接口 → cs 前缀完全相同；`at` 不同 → cs 不同。

```
at=1a0cb74355e  → 0280753a726ffc06d69b07b6 (chat/fold/keyword)
at=1a0cb74355e  → 0280753a726ffc06d69b07b6 (preAppUpgrade)   ← 前缀一致
```

309 个不同 at 值中，**0 例**出现「at 相同但 cs 前缀不同」。

因此早先"同一参数 15 次返回 15 个不同 cs"的观察，实为 `at` 每次递增所致，
**cs 不含随机数，是 f(at, url, 排序后参数) 的确定性输出**。

`at` 头本身 = 毫秒级 Unix 时间戳的 hex（实测 `at=1a0cb75c385` ↔ `1790119887749` ↔ HAR 时间戳完全吻合）。

## 三、native 入口（JNI 表）

`libsoulpower.so` 的 `JNI_OnLoad` @ `0xf3f8c`：

```asm
adrp/add x1 → 0x2a345c   "cn/soulapp/android/soulpower/SoulPowerful"
adrp/add x1 → 0x329328   JNINativeMethod 表
mov w2, #0x180           ; 384 字节 = 16 项 × 24
mov w3, #0x10            ; 16 个方法
blr [x8, #0x6b8]         ; RegisterNatives
```

表 @ `0x329328`（16 项，每项 `{name, sig, fnPtr}`）：

```
[0]  i  ()String                                  0xf3928
[1]  d  ()String                                  0xee964
[2]  e  (Context)String                           0xeea1c
[3]  f  ([BJ)String                               0xf36ec
[4]  h  (Context,int,String,String)String         0xf2d94   ← cs 候选
[5]  k  (Context,int,String,String)String         0xf197c   ← cs 候选
[6]  l  (String)String                            0xf0a1c
[7]  c  (String)String                            0xeea4c
[8]  g  (Context,String×6)String                  0xeef24
[9]  j  ()String                                  0xf39e0
[10] m  ()String                                  0xf3c00
[11] n  ()I                                      0xf3ed0
[12] o  ()String                                  0xf3b48
[13] p  ()String                                  0xf3cb8
[14] q  ()String                                  0xf3d70
[15] r  ()String                                  0xf3e28
```

## 四、cs 生成器的算法骨架（h() @ 0xf2d94）

调用图（去重）：

```
0xf2dfc -> 0xe441c   初始化
0xf2e0c -> 0xe89c8   string 构造
0xf2e34 -> 0xe5df4   string 处理
0xf2e38 -> 0xe4fcc
0xf2e3c -> 0xe4290
0xf2e40 -> 0xe4840
0xf2e44 -> 0xe5eec
0xf2e4c -> 0xee028
0xf2e88 -> 0xef988   ← sprintf 类（见下）
0xf3040 -> 0xe95d4   ← MD5（标准，已确认常量 67452301/efcdab89/98badcfe/10325476）
0xf3094 -> 0xe8d04   ← hex 编码（表 "0123456789abcdef"）
0xf30f4 -> 0xe95d4   ← MD5 再次
0xf3110 -> 0xe8d04   ← hex 再次
0xf3460 -> 0xe8aa4   NewStringUTF（返回给 Java）
```

关键片段：

```asm
; 用 %08x 格式化 int 参数
0xf2e78: adrp x2, #0x29e000
0xf2e7c: add  x2, x2, #0x501      ; "%08x"     ← 0x29e501 内容确认为 "%08x"
0xf2e80: sub  x0, x29, #0xd0      ; 目标 buffer
0xf2e84: mov  w3, w19             ; w19 = 第 4 个 JNI 参数 (int)
0xf2e88: bl   #0xef988            ; sprintf(buf, "%08x", w19)

; 随后按索引表逐字符置换 sprintf 的结果
0xf2eac: add  x8, x8, x9
0xf2eb0: ldurb w8, [x8, #-0x31]   ; table[idx]
0xf2eb4: sturb w8, [x29, #-0xd0]
...（对 w20[0..7] 共 8 次，写入连续 8 字节）
```

同理 `0xf2f50` 处再来一次 `%08x` + 置换。

字符串常量（`.rodata`）：

```
0x2a345c  cn/soulapp/android/soulpower/SoulPowerful
0x2a3479  SoulPowerful
0x2a34a4  getSoulPowerfulString
0x2a34bc  thv3_00000000
0x2a34cc  ro.build.fingerprint
0x2a34e2  kG@yGB9
0x2a34f0  %lx
0x2a3500  thv3_
0x2a3508  x9JkXpR@fi
0x2a3511  wMH!TmZ-@fqrfkmETqg2iDx9JkXpR@fi
0x2a3524  789!@#xswEDCzxcv
0x29e501  %08x
```

`h()` 内部还出现 `add w8, w8, #0x61`（+ 'a'）与 `eor w9, w22, #0x23`（XOR '#'）。
`0xf3134` 之后出现除 10 魔数 `0xcccccccd`，用于十进制化。

## 五、slb / sla 的算法链（已完整还原）

Java 侧（jadx：`zu/l.java`、`zu/c.java`、`zu/m.java`）：

```java
slb = zu.l.a( zu.f.g() )                       // SoulDESUtils
zu.l.a(s) = zu.m.a( zu.c.a(s, SoulPowerful.e()) )
zu.c.a(str, key) = Base64( DES/ECB/PKCS5( str, key ) )   // 标准 base64 表
```

实测验证（用户抓包中的真实 slb）：

```
slb = dE1vSGF4bzBvYWVyQkZZSzEvanZ0N3NoZmxPWEY4U1p0TW9IYXhvMG9hZUNPOXFJaWM2TEJRPT0=
第 1 层 base64 → tMoHaxo0oaerBFYK1/jvt7shflOXF8SZtMoHaxo0oaeco9qiic6LBQ==
第 2 层 base64 → 40 字节
   b4ca076b1a34a1a7 ab04560ad7f8efb7 bb217e539717c499 b4ca076b1a34a1a7 823bda8889ce8b05
   ↑ 块0                                                    ↑ 块3（与块0相同）
```

块0 == 块3 → **ECB 模式铁证**（相同明文块导致相同密文块）。
`libsoulpower.so` 中另有明文字符串 `DES/ECB/PKCS5Padding` 与 `android/util/Base64` 印证。

**密钥 `SoulPowerful.e()`**：反汇编 `0xeea1c → 0xedd58 → 0xedc98` 得

```
0xedc98: bl 0xed71c           ; 生成源串（走 getPackageManager，读 APK 签名）
0xedcf0: bl 0xe95d4           ; MD5
0x0edcf8: mov w1, #0x10       ; 16 字节
0xedd00: bl 0xe8d04           ; hex → 32 字符
```

即 `e() = hex(MD5(源串))`，源串取自 **Android APK 签名/包信息**，
⇒ **该密钥是 Android 专有，iOS 版本必然不同**。

（备用常量候选，均已用真实 slb 试解失败：`NvAb7tUJYol6UNoBa5Jt`、`}%2R+\OSsjpP!w%X`、
`}r.GCD:nGF5.FX_t`、`6vYDbZ-xPWCuzyiVT-nqx_DoqBkDgfq2h`、`pVGXGRh1wXiGQ4XF2I1p4bsXrLI4o7yl`。）

## 六、结论：cs 已完整破解（全量抓包回测）

### 6.1 最终公式

1. `at` = 毫秒时间戳的**十六进制**（去掉 `0x`）；`sec = at / 1000`。
2. 两张置换表其实是 ASCII 数字串：`TA="42765183"`、`TB="25387164"`，
   `perm(s, T)` 即 `out[i] = s[T[i]-1]`（数字按 1 起算）。
3. 令 `s1 = %08x(sec)` 补足 8 位，`ha = perm(s1, TA)`、`hb = perm(s1, TB)`。
4. **MD5-A**：请求头按**名字升序**取值直接拼接（`user-agent, aid, at, av, di, sdi, tk`），
   末尾接常量 `SoulPowerful`，取 MD5 前 4 字节：`m = MD5(hdr + "SoulPowerful")`。
5. **MD5-B**：`path + "?" + 参数(键升序, k=v, 值已 URL 解码) + %08x(int(hb,16)) + "kG@yGB9"` 取整段 MD5。
   - GET 只有 query；`application/x-www-form-urlencoded` 的 POST **把 body 参数并入 query 一起排序**。
6. 18 字节缓冲拼成 36 字符十六进制：

   ```
   buf = 02 80 | m0 ha[0:2] m1 ha[2:4] m2 ha[4:6] m3 ha[6:8] | 07 b6 | b0 b1 b2 b3 | 07 b2
   ```

7. 回测：最新抓包 404 条 cs 中 **380 条逐字节命中**；其余 24 条 = 16 条客户端瞬态常量
   （`07b6` 偶发变 `03b6`，该位服务器无法校验）+ 8 条 HAR 未保存 POST body。
   `meet/see/me/v2` 的实抓请求 2/2 完全一致。

### 6.2 落地

`Soul.js` 内置 `soulCs()`：拦截 `/meet/see/me/v2` 响应后，若服务端没给 `userIdEcpt`，
脚本用同一套请求头（`at` 刷新为当前毫秒、`bi[0]` 同步）自签重放一次。
自检：`node script/test-soul-autopull.js`。

**自签重放的真实能力（2026-09-23 实测，勿夸大）：**

- 自签的 cs **服务端认可**：`/meet/mine/see` 用自签 cs 实测能拿到 12 万字节真数据。
- 但 `/meet/see/me/v2` 无论 `limit=20/100`、有无 `sortType`、换 `pageId`，
  服务端一律只回 17KB 的**匿名暗卡**（20 条 `buttonType:4`、`userIdEcpt:null`），
  也就是「code 10001 成功但一条真人都没有」。
- 结论：**真人身份只能来自 App 自己带正确上下文发出的响应**（揭晓缘分 / 历史会话），
  自签重放拿不到。所以脚本策略是：
  1. 服务端已给真人 → 原样放行；
  2. 服务端只给暗卡 → 用同接口缓存兜底，**且自签结果里没有真人时绝不覆盖**（见 6.4）；
  3. 自签请求 4 秒超时兜底，避免不给 `$done` 导致页面白屏。

### 6.3 边界

- `slb` 的密钥派生自 APK 签名，Android 专有；`cs` 用的是公共常量，跨端通用。
- 无 cs / cs 错 → `9000003` / `9000006`。
- `/meet/mine/see` 带 `limit=100` 会被服务端判 `9000006`，要用 `limit=20`。

### 6.4 已知坑：暗卡顶掉真名单 = 点头像空白

曾把自签结果无条件替换进响应。自签拿到的是暗卡（也带 `data.list`，但 `userIdEcpt` 全空），
一替换就把调用方刚用缓存填好的真名单顶掉，表现是**列表还在、点进头像一片空白**。
规则：只有 `harvestUsers(fresh.data)` 捞到人（`userIdEcpt` + `user` 同时存在）才允许替换，
其余一律保留原响应 / 缓存。回归测试见 `test-soul-autopull.js` 的 [6][7][8]。

## 七、复现用命令

```bash
# 取 JNI 表（Android）
python3 - <<'EOF'
import struct
from elftools.elf.elffile import ELFFile
P="libsoulpower.so"; data=open(P,"rb").read(); e=ELFFile(open(P,"rb"))
def va2off(va):
    for s in e.iter_sections():
        if s["sh_type"]!="SHT_NOBITS" and s["sh_addr"]<=va<s["sh_addr"]+s["sh_size"]:
            return s["sh_offset"]+(va-s["sh_addr"])
def val(va): return struct.unpack("<Q", data[va2off(va):va2off(va)+8])[0]
def cstr(p):
    o=va2off(p); return data[o:data.find(b"\x00",o)].decode("utf8","replace")
for i in range(16):
    va=0x329328+i*24
    print(i, cstr(val(va)), hex(val(va+16)), cstr(val(va+8)))
EOF

# 反汇编（capstone，无需 ghidra）
python3 -c "
from capstone import *
from elftools.elf.elffile import ELFFile
d=open('libsoulpower.so','rb').read(); e=ELFFile(open('libsoulpower.so','rb'))
o=[s for s in e.iter_sections() if s.name=='.text'][0]
md=Cs(CS_ARCH_ARM64,CS_MODE_ARM)
for ins in md.disasm(d[o['sh_offset']:o['sh_offset']+0x200], o['sh_addr']): print(hex(ins.address),ins.mnemonic,ins.op_str)
"
```
