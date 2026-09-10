# 黄豆短剧（hdmgdj.com 系）解锁脚本 v3.0.0

> 三平台统一：Quantumult X / Surge / Loon，同一份自包含脚本（零依赖纯 JS）。
> 最后更新：2026-09-10（真机抓包 + APK 拆包 + dart2js 反编译 + 全接口/全域名扫描）

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

这不是脚本写法问题，是**服务端硬闸门**。2026-09-10 通过「真机抓包 + APK 拆包 + dart2js 反编译 + 84 个付费集抽样」四重验证：

### 5.1 站点有两套内容体系

| 体系 | ID 形态 | 免费集视频 | 付费集视频 |
|---|---|---|---|
| **普通剧**（平台自营） | 裸 hex，如 `6a7f2e88817f7dacc5971d55` | `dedup/{hash}/seg_NNN.ts?auth_key=` 完整 HLS | **403**（`play` 返回 813005/813004，无任何 URL） |
| **UP 剧**（创作者上传） | `up_xxxx`，如 `up_781a6cd5e8ce4d4a` | 同上，完整 HLS | `play` 返回 `status:"y"` + **`is_preview:true`** + `article-video/uv_xxx/preview.mp4`（**6.00 秒**） |

> 每集都有独立 `uv_` id（免费集也有）。免费集的 `uv_` 目录下也只有 `preview.mp4`，正片走 `dedup`。

### 5.2 为什么解不开（逐条实测）

| 环节 | 结论 |
|---|---|
| **权限闸门** | 唯一判据是「这一集的 `type`」：`free` 放行，`coin`/`vip` 必须已购/VIP。**与 `free_episodes` 数字无关**（有剧 `free_episodes=0` 但 6 集全能播） |
| **签名 `sig`** | ★ 关键实验：借免费集的 `sig` 去打**其它免费集** → **200**（同剧 seq2、异剧 seq1 都通）；打**付费集** → **403**。**证明 `sig` 不绑定路径**，服务端唯一判据是用户权益 |
| **`/up/unlock`** | 参数已挖到（`{object_type, object_id}`）但一律 `2001 请求数据错误` —— 该 UP 主 `sub_enabled=0` 未开订阅 |
| **`/up/access`** | 查询接口本身无漏洞（不传对参数返回 `can_view:true` 是默认值） |
| **`/drama/doReward`** | 真相是**打赏**（`{id, amount, seq}`），报 813108「这部剧还没有创作者」 |
| **新账号** | 注册全新设备账号打付费集**照样 403** → 与账号无关，纯内容判定 |
| **84 个付费集抽样** | 60 部剧、84 个 `coin`/`vip` 集 → **0 个能播** |
| **CDN** | `dedup/{hash}` 要 `auth_key`（去掉即 403）；`article-video/uv_xxx/` 下除 `preview.mp4` 外全部 403；两个 CloudFront 桶都禁止列举（`AccessDenied`） |
| **支付** | 第三方网关（支付宝 `hongyanyanbaihuo.online`、USDT `nsybillduxoaus.com`），**伪造回调属诈骗，不做** |
| **金币** | 签到 1 币/天、任务空、邀请 0 币；`doBuy` 服务端校验余额（203001），6 种参数组合全失败 |

**结论：付费集正片是纯服务端权益校验，客户端侧无解。**
本脚本对付费集的处理是：把播放地址指向该集公开的 6 秒 `preview.mp4`（可用 `previewFallback=false` 关闭）。

> 同类公开方案（Yu9191/Rewrite 的 `huangdou.js`）同样只能塞 6 秒试看片，其「完整播放」描述不成立。
> **免费剧 / 免费集是完整正片**（例如《我的女友景甜恶搞版》第 5 集 241 秒），脚本对这部分完全正常。

---

## 六、更新日志

### v3.0.0 — 2026-09-10「会员 + 金币」客户端全解锁
- **会员身份**：`user/doVip` / `user/doRecharge` → 开通/充值一律返回成功（end_time=2099-12-31），不再弹支付；`user/home`（自己）也标为 VIP
- **无限金币**：`user/accountLog` 追加重额赠送流水（钱包页余额显示）；`user/sign` 30 天全签；`user/doSign` 巨额奖励；`user/orderLog`/`buyLog`/`codeLog` 清空
- **任务/兑换/抽奖**：`task/list` 注入可领任务；`redeem/list` / `lottery/info` 同样处理
- **购剧**：`drama/doBuy` 返回 `status:true`，客户端会把剧集标记为已购、剧集列表全部显示已解锁
- 修正 v2.1.0 的路由冲突（`user/home` 被列表规则截走）
- 测试：`test_v5.js` **16 PASS / 0 FAIL**

### v2.1.0 — 2026-09-10
- **新增 UP 创作者模块处理**（抓包 + dart2js 反编译挖出真实参数）：
  - `/up/access {object_type, object_id}` 是客户端**判断能不能看**的权限接口 → 强制 `can_view=true` + `access="free"` + `price_coin=0` + `sub_enabled=0`
  - `/up/episodeFeed`、`/up/contentList`、`/up/recommend`、`/up/detail` 等列表 → 清掉 `can_view` / `ep_is_free` / `ep_price_coin` / `episode_min_coin` / `access` / `corner`
  - `/up/unlock`、`/up/subscribe`、`/up/episodeDetail` → 伪造成功
- 修正脚本头部协议说明：`is_preview` 缺省值确认是 `true`（`J.x(...,!0)`）
- 确认**每一集都有独立 `uv_` 视频 id**（`/drama/play` 的 `preview_m3u8` 暴露）

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
