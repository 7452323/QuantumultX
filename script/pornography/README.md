# lzlukvca.cc（黄豆短剧）金币剧集 + 会员剧集解锁

对 `lzlukvca.cc` 短剧站 `/api/drama/detail`、`/api/drama/play`、`/api/drama/doBuy`、`/api/user/info|recharge` 接口的加密流量做**实时解锁**：

- **detail 响应**：解密后将全部剧集改写为 `type=free` + `is_buy=true` + `price=0` + `methods=[]`，同时清空 `coin_episodes` / `points_episodes` / `vip_episodes`，置 `is_buy_whole=true` / `episode_price=0` / `free_episodes=全集数`。App 端单集判定 `ans() = !(type==='free'||'') && !is_buy` 恒为 false → 播放入口 **直接发 /drama/play，不弹任何金币/会员窗**；
- **play 请求（REQUEST 阶段）**：把加密请求体原样存入 `$persistentStore('lzlukvca_play_req')`（规则引擎在 RESPONSE 脚本中读不到 `$request.body`，这是取 drama_id+seq 的唯一途径）；
- **play 响应**：命中 `813004（VIP 会员专享）/ 813005（金币解锁）/ 813006（其它付费）` 任一付费错误时，从 `$persistentStore` 读取请求体解密出 `drama_id + seq`，**同步伪造成功响应**（`status=y` + 可预测 m3u8 直链）重加密返回。**必须同步 $done**——规则引擎（WKWebView）不支持异步回调后的 $done（旧版先抓 m3u8/enc.key 再 $done 导致 play 伪造从未生效）；
- **doBuy 响应**（确认解锁/购买接口）：一律伪造成功（`status=true`）兜底；
- **user/info、user/recharge 响应**：金币 `999999` + 显示钻石会员（`is_vip=y` / `group_name=钻石会员` / `group_end_time=2099-12-31`）；
- **其余流量**（非上述接口、已成功响应、解密失败）原样放行，绝不影响正常访问。

> ⚠️ 说明：本脚本用于学习研究目标站点的加密协议。请遵守目标站点的服务条款与当地法律法规。

---

## 协议摘要（逆向分析结论）

- 请求与响应均为 `IV(16B) || AES-256-CBC(PKCS7, gzip(JSON))`，`Content-Type: application/octet-stream`；play 请求体是 `application/x-www-form-urlencoded` 的原始密文字节。
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
  - `play`：成功返回 `data.m3u8`/`data.lines[]`；付费错误码：`813004`（VIP 会员专享，“该短剧为 VIP 专享，开通会员后即可观看”）/ `813005`（金币，“本集需金币解锁”）/ `813006`（其它付费），均为 `{"status":"n","error":"...","errorCode":xxx}`。
- App 端播放判定（前端逆向）：episodes 单集解析器 d2c 读 **`type`** 字段（非 pay_type）；点集数播放入口 wD：若 `ans(seq)=true`（type 非 free/空 且 `is_buy=false`）走 qu 解锁弹窗，`anP()` 只把 `type==='coin'/'points'` 当可解锁项，**其它值（含 free/vip/空）一律弹“VIP 会员专享”窗且不发 play**；若 `ans(seq)=false`（免费剧或 `is_buy=true`）**直接发 /drama/play**。因此脚本把全部剧集 type 改成 `free`（ans=false → 直接发 play，由 play 侧伪造解锁）。
- m3u8 直链可预测：`https://lzlukvca.cc/api/drama/hls/{drama_id}/{seq}/play.m3u8?line=free`。

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
3. 打开 App 触发 detail/play 请求，金币/会员剧集即可直接播放。

### Loon
1. 导入 `lzlukvca.plugin`（Loon → 插件 → 添加插件 → 粘贴 raw 链接）。
2. 开启 **HTTPS 解密（MitM）**，安装并信任证书。
3. 打开 App 触发 detail/play 请求，金币/会员剧集即可直接播放。

### Quantumult X
1. 将 `lzlukvca.qxrewrite` 中的 `[rewrite_local]` 与 `[mitm]` 段合并进自己的配置（脚本为**远程 URL**，QX 自动缓存更新，无需手动下载）。
2. 若你的 QX 版本较老不识别远程脚本：把 `lzlukvca.js` 下载到 Scripts 目录（iCloud Drive/Quantumult X/Scripts/），并把 `qxrewrite` 里两处 `https://raw...lzlukvca.js` 改为 `lzlukvca.js`。
3. 开启 **MitM**，安装并信任证书。
4. 打开 App 触发 detail/play 请求，金币/会员剧集即可直接播放。

> 三个平台都需要先安装根证书并在系统设置里信任，否则无法解密 HTTPS 流量。

## 解锁日志示例

detail 响应全免费改写：
```
[lzlukvca] detail unlocked episodes=8
```

play 请求体缓存（REQUEST 阶段）：
```
[lzlukvca] REQ play ctx saved b64len=236
```

play 813004/813005/813006 同步伪造成功：
```
[lzlukvca] play 813005 forged(sync) drama_id=rp_6a52d26d0e18e7c330a8d1f0 seq=4
```

user/info 伪造：
```
[lzlukvca] user forged is_vip=y balance=999999
```

## 脚本行为细节

- 阶段判定：`typeof $response !== 'undefined'` 为响应阶段，否则为请求阶段（REQUEST 阶段仅 play 请求存体）。
- body 适配：Surge/Loon 在 `binary-body-mode=true` 下 body 为 base64 字符串、输出 `Uint8Array`；**QX 下 body 为原始字符串、二进制响应体走 `bodyBytes`(ArrayBuffer)、输出 `bodyBytes`**；脚本自动识别三平台两种形态。
- 容错：requestId 缺失/错误、body 为空、解密或 JSON 解析异常 → 原样放行。
