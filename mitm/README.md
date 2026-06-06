# 句读 (JudouRili) MITM 代理解锁方案

## 服务器
- IP: `198.46.189.141`
- 代理端口: `8080`
- 证书: `jd_mitm_ca.pem` (mitmproxy CA)

## 手机设置
1. 安装 CA 证书 (jd_mitm_ca.pem) → 设置 → 通用 → 描述文件 → 信任
2. WiFi → HTTP 代理 → 手动 → 服务器 `198.46.189.141` 端口 `8080`
3. 打开句读 App → 测试会员功能

## 篡改覆盖
| 端点 | 修改 |
|------|------|
| /api/v2/users/wechat | is_member→true, role→member |
| /api/v2/t/i | r→true |
| /api/v2/common/global_config | templates free, ads=0 |
| /api/v2/products | 全部免费 |
| /api/v2/ads | 清空广告 |
