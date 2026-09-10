# 黄豆短剧（hdmgdj.com 系）解锁脚本 v2.0.0

> 三平台统一：Quantumult X / Surge / Loon，同一份自包含脚本（零依赖纯 JS）。
> 最后更新：2026-09-10（真机抓包复核）

---

## 一、安装

| 平台 | 引用地址 |
|---|---|
| **Quantumult X** | `https://raw.githubusercontent.com/7452323/QuantumultX/main/script/pornography/lzlukvca.conf` |
| **Surge / Loon** | `https://raw.githubusercontent.com/7452323/QuantumultX/main/script/pornography/lzlukvca.sgmodule` |

- QX：设置 → 重写 → 引用，添加上面的 `.conf`
- Surge：Modules → 安装 `.sgmodule`
- Loon：插件 → 添加 `.plugin`（或直接用 `.sgmodule`）
- **务必开启 MITM 并信任证书**（配置里已带全量 43 个域名）

### 可调参数（`$argument` / 模块 argument）

| 参数 | 默认 | 说明 |
|---|---|---|
| `previewFallback` | `true` | 付费集播放退化为 6 秒试看片；`false` = 保留原「需金币解锁」弹窗 |
| `stripAds` | `true` | 去广告、去启动页、去弹窗 |
| `fakeVip` | `true` | 「我的」页显示 VIP + 999999 金币/积分 |
| `debug` | `false` | 输出 `[hdmgdj]` 日志 |

例：`argument=previewFallback=false,debug=true`

---

## 二、域名覆盖（43 个，全部实测可用、同一后端）

| 组 | 数量 | 域名 |
|---|---|---|
| APP 线路 | 15 | pbahpylc.cc、zxpxzvza.cc、cbzegnsi.cc、svlyibwt.cc、hddj01/02/03/08/09/22.com、bhanpslw.top、ftvshtpa.top、qlczebty.top、mocqhwfk.top、uwfjkoxh.cc |
| H5 线路 | 9 | nsokaymn.cc、iwgsqufx.cc、nbsito.top、tideember.cc、momodrift.top、zuzuspot.top、zuzucast.top、glowcanvas.cc、eyeonneb.cc |
| API 线路 | 10 | larksummit.icu、niniharbor.top、kucvcxrv.cc、onyxripple.cc、ferncider.cc、larkgarden.top、vivifable.top、sxqirtho.top、qicuknlj.top、hvthtcpa.top |
| 入口/发布页 | 9 | hdmgdj.com、seiopcc.icu、vhuoksd.wiki、nptmguft.cc、lyfxoxpf.cc、exmuiawd.cc、svkexyoz.cc、halobloom.cc、mintgate.top |

> 域名列表来源：`hdmgdj.com` 发布页（AES-256-GCM 加密的 `d.txt`）+ `/api/site-config` + `/api/system/info` 的 `api_lines`。
> **域名会轮换**，若某天全部失效，重新跑一次上面三步即可拿到新列表。

---

## 三、协议（2026-09-10 真机抓包复核，未变）

```
请求/响应 body = IV(16B) || AES-256-CBC(PKCS7, gzip(JSON))
AESKey(32B)   = HMAC-SHA256( key = UTF8(平台KeyHex), msg = hexDecode(requestId 去掉横线) )

平台 Key：web     = 7961beb44246e3012ce228d6b5ced05a
          ios     = 6be13f303785864aac6a6cc2cb3c9dc6
          其它    = c10ca2986a31fb46d4481ce8631c2725

请求头：requestId / deviceType / version / time / sign / sessionId
        sign = md5("Dart|sessionId|requestId|time|path") + "-" + time   （盐是字面量，非密钥）
响应头：Requestid 回显 requestId
```

---

## 四、本版做了什么

1. **全剧集解锁**：`detail` 里所有剧集改为 `type="free"` + `is_buy=true`
   ⚠️ 新版客户端判定顺序是「**先看 `type==="vip"` → 直接弹会员窗**，再看 `is_buy`」，
   所以 `type` 必须清成 `free`，绝不能留 `vip`（这是与旧版最大的区别）。
2. **去广告**：`system/info` 清空启动页/弹窗/所有广告位并强制可跳过；`ad/policy` 关掉前贴/插播/暂停广告。
3. **会员与余额**：`user/info`、`user/recharge`、`user/vip` 显示 VIP + 999999 金币/积分 + 无限播放次数。
4. **列表清洗**：`navBlock` / 搜索 / 排行 / 收藏等列表里的付费角标与广告位清掉。
5. **doBuy / up 解锁类接口**：一律返回成功。
6. **播放**：`is_preview` 强制 `false`；付费集走试看兜底（见下）。

---

## 五、⚠️ 必须知道：付费集正片目前解不开

这不是脚本写法问题，是**服务端硬闸门**。2026-09-10 实测结论：

| 环节 | 状态 |
|---|---|
| 服务端播放闸门 | `/api/drama/hls/{id}/{seq}/play.m3u8` 对**付费集一律 403**（`seq > free_episodes`），免费集任意 seq 都 200 |
| m3u8 签名 `sig` | 64 位十六进制，**服务端私钥 HMAC**，试遍 8 把候选密钥 × 30 种消息模板均不中，无法伪造 |
| CDN 分片 | 必须带 `auth_key`（CloudFront 签名），去掉即 403 |
| 分片路径 | `dedup/{内容哈希}/`，哈希不可从剧集信息推导 |
| 支付 | 第三方网关（支付宝 `hongyanyanbaihuo.online`、USDT `nsybillduxoaus.com`），伪造回调属于诈骗，不做 |
| 金币 | 每日签到 1 币、任务列表为空、邀请 0 币，无可用漏洞；`doBuy` 服务端校验余额，参数无法绕过 |
| 其他接口 | `up/*` 需创作者权限（813105）；openapi key 已过期；`up/unlock` 等无越权 |

**因此本脚本对付费集的处理是：把播放地址指向该集公开的 6 秒试看片 `preview.mp4`**
（从 detail 缓存的 `cover.jpg` 推导，路径 `…/chapters/{seq}/preview.mp4`，CDN 上公开可取，实测 480×854 / 584kbps / **6.000 秒**）。

想要完整正片，目前只有两条真实可行路径：
1. **攒金币**（每日签到 + 积分任务换币）后正常购买；
2. **开会员**（支付宝/USDT 充值）。

> 同类公开方案（如 Yu9191/Rewrite 的 `huangdou.js`）对付费集也是塞这个 6 秒试看片，
> 其模块描述写的「完整播放」并不成立 —— 本仓库如实标注。

---

## 六、更新日志

### v2.0.0 — 2026-09-10
- 域名从 1 个（`lzlukvca.cc`，已下线）扩展到 **43 个**（APP/H5/API/入口四组）
- 适配新版客户端判定语义：`type=free` + `is_buy=true`（旧版 `type=coin` 已失效）
- `play` 响应补齐 `is_preview=false`（缺省为 `true` 会被当试看）、`lines` 结构对齐真实响应
- 新增去广告（启动页/弹窗/插播/前贴）、`ad/policy`、列表付费标记清洗、`user/vip`
- 付费集新增试看兜底（可用 `previewFallback=false` 关闭）
- 全流程同步 `$done`（WKWebView 规则引擎不支持异步回调后 `$done`）
- REQUEST 阶段缓存 ctx（requestId / deviceType / play 请求体），按 host 隔离，多域名互不串

### v1.0.0 — 2026-08-04（lzlukvca.cc 时代）
- 首次逆向 AES-256-CBC + gzip 协议、813004/813005/813006 错误码语义
- detail 全免费 + play 伪造 + doBuy/user 伪造
