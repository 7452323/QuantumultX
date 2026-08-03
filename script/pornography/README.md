# lzlukvca.cc（黄豆短剧）协议只读诊断

对 `lzlukvca.cc` 短剧站 `/api/drama/detail` 与 `/api/drama/play` 接口的加密流量做**只读诊断**：

- 解密请求/响应体，把明文 JSON 输出到代理工具控制台，便于观察协议结构与业务字段；
- **流量原样放行（`$done({})`），不做任何内容修改**；
- 解密失败（requestId 缺失/错误、body 为空、格式异常）时同样原样放行，绝不影响正常访问。

> ⚠️ 合规说明：本脚本仅用于流量观测与协议学习，**不包含**任何绕过付费、伪造服务端授权或解锁收费内容的功能。请遵守目标站点的服务条款与当地法律法规。

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
- 压缩：服务端返回 gzip；客户端请求同样为 gzip/zlib（脚本内置完整 inflate，支持 stored/fixed/dynamic Huffman 与 gzip/zlib 两种包装）。
- 业务结构：
  - `detail`：`data.episodes[]`（`seq/type/price/is_buy/methods`）、`coin_episodes[]`、`episode_price`、`free_episodes`、`is_buy_whole` 等。
  - `play`：成功返回 `data.m3u8`/`data.lines[]`；收费剧集返回 `{"status":"n","error":"本集需金币解锁","errorCode":813005}`。

## 文件清单

| 文件 | 说明 |
|---|---|
| `lzlukvca.js` | 三平台统一脚本（QX / Surge / Loon），纯 JS 自包含，零外部依赖 |
| `lzlukvca.sgmodule` | Surge 模块 |
| `lzlukvca.plugin` | Loon 插件 |
| `lzlukvca.qxrewrite` | Quantumult X 配置片段 |

## 安装

### Surge
1. 导入 `lzlukvca.sgmodule`（Surge → 模块 → 安装新模块 → 粘贴 raw 链接）。
2. 开启 **MitM**，安装并信任证书。
3. 打开 App 触发 detail/play 请求，在 Surge 控制台查看 `[lzlukvca]` 前缀日志。

### Loon
1. 导入 `lzlukvca.plugin`（Loon → 插件 → 添加插件 → 粘贴 raw 链接）。
2. 开启 **HTTPS 解密（MitM）**，安装并信任证书。
3. 在 Loon 日志中查看 `[lzlukvca]` 前缀日志。

### Quantumult X
1. 下载 `lzlukvca.js` 放入 Quantumult X 的 Scripts 目录（iCloud Drive/Quantumult X/Scripts/）。
2. 将 `lzlukvca.qxrewrite` 中的 `[rewrite_local]` 与 `[mitm]` 段合并进自己的配置。
3. 开启 **MitM**，安装并信任证书。
4. 在 QX 日志/控制台查看 `[lzlukvca]` 前缀日志。

> 三个平台都需要先安装根证书并在系统设置里信任，否则无法解密 HTTPS 流量。

## 诊断输出示例

请求（detail）：
```
[lzlukvca] REQ https://lzlukvca.cc/api/drama/detail
[lzlukvca] {"token":"D_...","deviceId":"...","data":{"id":"rp_..."}}
```

响应（play 收费错误）：
```
[lzlukvca] RESP https://lzlukvca.cc/api/drama/play
[lzlukvca] {"status":"n","error":"本集需金币解锁","errorCode":813005}
```

## 脚本行为细节

- 阶段判定：`typeof $response !== 'undefined'` 为响应阶段，否则为请求阶段。
- body 适配：Surge/Loon 在 `binary-body-mode=true` 下 body 为 `Uint8Array`；QX 下为 base64 字符串，脚本自动识别两种形态。
- 容错：requestId 缺失/错误、body 为空、解密或 JSON 解析异常 → 仅输出 `decrypt=skip/fail` 日志并原样放行。
