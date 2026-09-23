# Soul App 请求签名（cs / slb）逆向记录

逆向目标：Soul iOS/Android 6.37.0 的 HTTP 签名头，用于让脚本能自行构造合法请求
（特别是 `/meet/uncover/list`「揭晓缘分」，服务端在访客列表接口只下发标签、身份字段全 null）。

样本来源：APK `cn.soulapp.android`（xapk，284 MB）→ `config.arm64_v8a.apk` →
`libsoulpower.so`（3.4 MB）+ 29 个 `classes*.dex`。

工具：jadx 1.5.0（需自备 JRE，apt 装不上时用 Adoptium tar 包）。

## 一、签名头一览

由 `yu/f.java`（`ParamsInterceptor`，classes6.dex）统一注入：

| 头 | 来源 |
| --- | --- |
| `di` | `xu.r.e` 设备 ID |
| `sdi` | `zu.f.b()` |
| `aid` | `xu.r.b` |
| `av` | `xu.r.c` 版本名 |
| `avc` | `xu.r.a()` |
| `at` | `Long.toHexString(now - 开机时间)` |
| `sla` | `zu.l.a(zu.f.d(app))` |
| `slb` | `zu.l.a(zu.f.g())` |
| `tk` | 登录态，来自 `xu.r.g` |
| `cs` | `SoulPowerful.l(app, 秒级时间戳, url, headers)` |

## 二、cs 生成算法（核心）

`yu/f.java` 中的完整逻辑，语言无关的步骤：

```
1. 取以下 7 个头的「值」，按头的名字做字母序排序后依次拼接（跳过空值）：
     at, aid, av, di, sdi, tk, User-Agent
   → headersConcat

2. 构造 url 串：
     encodedPath + "?" + 参数按「参数名」排序后的 k=v&k=v 形式
   （同名多值用逗号连接后再参与拼接；无参数则不带 "?"）
   → urlStr

3. cs = SoulPowerful.l(context, currentTimeMillis / 1000, urlStr, headersConcat)
```

对应反编译片段：

```java
java.lang.String[] strArr = {"tk", "di", "sdi", "aid", "av", "at", "User-Agent"};
java.util.Arrays.sort(strArr);
java.lang.StringBuilder sb3 = new java.lang.StringBuilder();
for (int i = 0; i < 7; i++) {
    java.lang.String str3 = strArr[i];
    if (!android.text.TextUtils.isEmpty(build.header(str3))) {
        sb3.append(build.header(str3));
    }
}
java.lang.StringBuilder sb4 = new java.lang.StringBuilder();
sb4.append(build.url().encodedPath());
// ... 这里按参数名 Arrays.sort(strArr2) 后追加 k=v&k=v ...
builder.addHeader("cs", cn.soulapp.android.soulpower.SoulPowerful.l(
    application, (int) (currentTimeMillis / 1000), valueOf, java.lang.String.valueOf(sb3)));
```

### cs 的形态

固定 36 个 hex 字符（18 字节），407 份抓包样本逐字符统计后：

- 固定位：`0-3`(`0280`)、`6-7`(`3a`)、`11`(`f`)、`14-15`(`06`)、`19-23`(`b07b6`)、`32-35`(`07b2`)
- 变化位：`4,5,8,9,10,12,13,16,17,18,24-31`（18 个 nibble）

结论：**不是 hash、不是 XOR、不是简单编码，而是 native 分组加密后的产物**。
同一 (path + 全部参数) 重复 15 次得到 15 个不同 cs，说明含时间戳/随机量 —— 无法用 key 无关的方式复现，
必须拿到 native 实现或算法常量。

## 三、辅助编码（已完整还原）

### 3.1 `zu/c` = DESUtil

```java
public static String a(String str, String str2) {   // str2 = key
    Cipher cipher = Cipher.getInstance("DES");
    cipher.init(1, b(str2));
    return zu.c.a.a(cipher.doFinal(str.getBytes()));   // 再 Base64
}
private static SecretKey b(String str) {
    SecretKeyFactory f = SecretKeyFactory.getInstance("DES");
    DESKeySpec spec = new DESKeySpec(str.getBytes());   // key 须 8 字节
    return f.generateSecret(spec);
}
```

DES/ECB/PKCS5Padding，明文 `str`，密钥为 8 字节字符串，输出标准 Base64。

### 3.2 `zu/m` = UrlBase64

自定义实现，编码表为
`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`，
解码表把 `+`→62、`/`→63，即标准 Base64 的码表，只是自己写了一版。

### 3.3 `zu/l` = SoulDESUtils

```java
public static String a(String str) {
    return zu.m.a(zu.c.a(str, cn.soulapp.android.soulpower.SoulPowerful.e()));
}
```

即 `slb = Base64(DES(str, SoulPowerful.e()))`，`str` = `zu.f.g()` = 设备机型标识，
密钥 `SoulPowerful.e()` 来自 native。

## 四、native 入口（libsoulpower.so）

JNI 采用**动态注册**，so 内无 `Java_*` 符号。`JNINativeMethod` 表位于 `.data.rel.ro`，
起始 VA 约 `0x329360`，每项 24 字节 `{name, signature, fnPtr}`。

已定位的项：

| signature | fnPtr |
| --- | --- |
| `(Landroid/content/Context;ILjava/lang/String;Ljava/lang/String;)Ljava/lang/String;` | `0xf2d94` |
| 同上 | `0xf197c` |
| `(Landroid/content/Context;Ljava/lang/String;)Ljava/lang/String;` | `0xf38c` 附近 |
| `()Ljava/lang/String;` | 多个（含 `e()` 密钥取值） |

其中 `(Context, int, String, String) → String` 即 cs 生成函数。两个候选指向同一语义
（一个可能是另一版本路径）。

### Section 布局（供后续定位）

```
.text         0xd3000 - 0x29e2bc
.rodata       0x29e2c0 - 0x2ed5d1
.data.rel.ro  0x30b090 - 0x3376e0
.data         0x33e000 - 0x33f9b0
```

## 五、复刻状态

| 项 | 状态 |
| --- | --- |
| cs 输入组装规则（7 头 + url） | ✅ 已还原 |
| cs 输出算法 | ❌ 待反汇编 `0xf2d94` / `0xf197c` |
| DES 编码器 | ✅ 已还原 |
| Base64 码表 | ✅ 已还原 |
| `SoulPowerful.e()` 密钥 | ❌ native 返回，待提取 |

## 六、给脚本的结论

在 cs 未复刻前，脚本**不主动构造**任何带签名的请求（改路径/改参数一律 `9000006`，
实测 407 个样本签名交叉复用全部被拒）。做法改为：

- 只拦截客户端自己发起的请求（签名天然合法）
- `/meet/uncover/list`（揭开缘分）响应抓到就缓存，供「谁看过我」列表回填
- `see/me/v2` 只认服务端本次下发；本接口不下发身份时用缓存兜底

`cs` 一旦复刻成功，即可脱离客户端直接请求任意接口。
