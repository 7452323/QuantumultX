# lzlukvca.cc（黄豆短剧）金币剧集 + 会员剧集解锁

对 `lzlukvca.cc` 短剧站 `/api/drama/detail` 与 `/api/drama/play` 接口的加密流量做**实时解锁**：

- **detail 响应**：解密后将全部剧集改写为已解锁（`type=free` / `pay_type=coin`（绕过 App 端 VIP 会员弹窗判定） / `is_buy=true` / `can_vip_watch=false`（自动连播直接判定可播） / `price=0` / `methods=[]`，同时清空 `coin_episodes` / `points_episodes` / `vip_episodes`，置 `is_buy_whole=true` / `episode_price=0` / `pay_type=free` / `can_vip_watch=true`），重加密返回，App 端不再显示锁与会员标记；
- **play 响应**：命中 `813004（积分解锁）/ 813005（金币解锁）/ 813006（会员专享）` 任一付费错误时，从请求体读取 `drama_id + seq`，抓取可预测的 m3u8 直链并提取**真实 enc.key（AES-128）**，伪造成功响应（`status=y` + `hls_key`）重加密返回，金币/会员剧集均可直接播放；
- **其余流量**（非 detail/play、已成功响应、请求阶段）原样放行，解密失败时同样放行，绝不影响正常访问。

> ⚠️ 说明：本脚本用于学习研究目标站点的加密协议。请遵守目标站点的服务条款与当地法律法规。

---

## 协议摘要（逆向分析结论）

- 请求与响应均为 `IV(16B) || AES-256-CBC(PKCS7, gzip(JSON))`，`Content-Type: application/octet-stream`。
- AES 密钥派生：
  ```
  AESKey(32B) = HMAC-SHA256(key = UTF8(平台KeyHex字符串), msg = hexDecode(requestId 去掉横线))
  ```
- 平台 Key（按请求头 `deviceType` 选择）：
  | deviceType | Key Hex |
  |---|---|
  | `web` | `7961beb44246e3012ce228d6b5ced05a` |
  | `ios` | `6be13f303785864aac6a6cc2cb3c9dc6` |
  | 其他 | `c10ca2986a31fb46d4481ce8631c2725` |
- 响应 `Requestid` 头与请求 `requestId` 头一致，直接用该值派生密钥。
- 压缩：服务端返回 gzip；客户端请求同样为 gzip/zlib（脚本内置完整 inflate，支持 stored/fixed/dynamic Huffman 与 gzip/zlib 两种包装；重加密用 zlib stored block + Adler-32）。
- 业务结构：
  - `detail`：`data.episodes[]`（`seq/type/pay_type/price/methods`）、`coin_episodes[]`、`vip_episodes[]`、`points_episodes[]`、`episode_price`、`free_episodes`、`is_buy_whole`、`can_vip_watch` 等。
  - `play`：成功返回 `data.m3u8`/`data.lines[]`；付费错误码：`813004`（积分）/ `813005`（金币）/ `813006`（会员专享），均为 `{"status":"n","error":"...","errorCode":xxx}`。
- App 端播放判定（前端逆向）：点集数时若 `episodes[i].pay_type==='coin'/'points'` 走解锁弹窗并发 play 请求，**其它值（含 free/vip）一律弹“VIP 会员专享”窗且不发 play 请求**——因此解锁脚本必须把每集 `pay_type` 写成 `coin` 并 `is_buy=true` 才能让 App 发 play。
- m3u8 直链可预测：`https://lzlukvca.cc/api/drama/hls/{drama_id}/{seq}/play.m3u8?line=free`，内部 `#EXT-X-KEY:...URI="...enc.key?auth_key=..."` 可直接抓取返回 16 字节真实 AES-128 密钥。

## 文件清单（raw 链接）

| 文件 | 说明 |
|---|---|
| [`lzlukvca.js`](https://raw.githubusercontent.com/7452323/QuantumultX/main/script/pornography/lzlukvca.js) | 三平台统一脚本（QX / Surge / Loon），纯 JS 自包含，零外部依赖 |
| [`lzlukvca.sgmodule`](https://raw.githubusercontent.com/7452323/QuantumultX/main/script/pornography/lzlukvca.sgmodule) | Surge 模块 |
| [`lzlukvca.plugin`](https://raw.githubusercontent.com/7452323/QuantumultX/main/script/pornography/lzlukvca.plugin) | Loon 插件 |
| [`lzlukvca.qxrewrite`](https://raw.githubusercontent.com/7452323/QuantumultX/main/script/pornography/lzlukvca.qxrewrite) | Quantumult X 配置片段 |

目录：https://github.com/7452323/QuantumultX/tree/main/script/pornography

## 安装

### Surge
1. 导入 `lzlukvca.sgmodule`（Surge → 模块 → 安装新模块 → 粘贴 raw 链接）。
2. 开启 **MitM**，安装并信任证书。
3. 打开 App 触发 detail/play 请求，金币剧集即可直接播放。

### Loon
1. 导入 `lzlukvca.plugin`（Loon → 插件 → 添加插件 → 粘贴 raw 链接）。
2. 开启 **HTTPS 解密（MitM）**，安装并信任证书。
3. 打开 App 触发 detail/play 请求，金币剧集即可直接播放。

### Quantumult X
1. 下载 `lzlukvca.js` 放入 Quantumult X 的 Scripts 目录（iCloud Drive/Quantumult X/Scripts/）。
2. 将 `lzlukvca.qxrewrite` 中的 `[rewrite_local]` 与 `[mitm]` 段合并进自己的配置。
3. 开启 **MitM**，安装并信任证书。
4. 打开 App 触发 detail/play 请求，金币剧集即可直接播放。

> 三个平台都需要先安装根证书并在系统设置里信任，否则无法解密 HTTPS 流量。

## 解锁日志示例

detail 响应全免费改写：
```
[lzlukvca] detail unlocked episodes=8
```

play 813005/813006 伪造成功：
```
[lzlukvca] play 813005 -> forge drama_id=rp_6a52d26d0e18e7c330a8d1f0 seq=4
[lzlukvca] play forged hls_key=real
```

## 脚本行为细节

- 阶段判定：`typeof $response !== 'undefined'` 为响应阶段，否则为请求阶段。
- body 适配：Surge/Loon 在 `binary-body-mode=true` 下 body 为 `Uint8Array`；QX 下为 base64 字符串，脚本自动识别两种形态。
- 异步：QX 用 `$task.fetch().then()`、Surge/Loon 用 `$httpClient.get` 回调抓取 m3u8/enc.key，带 5 秒超时兜底；取 key 失败时仍伪造成功响应（`hls_key` 为空，App 端可尝试直连 m3u8）。
- 容错：requestId 缺失/错误、body 为空、解密或 JSON 解析异常 → 原样放行。
