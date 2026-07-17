---
name: web-api-protocol-reverse
description: Web API 协议逆向技能。破解 ChatGPT/OpenAI 等官网私有协议，还原 API 请求链、认证流、PoW/Turnstile 抗爬虫机制。对接 OpenAI 兼容接口适配层。
author: 7452323
category: reverse-engineering
tags: [web-api, protocol-reverse, chatgpt, openai, turnstile, pow]
---

# Web API Protocol Reverse — Web API 协议逆向

## 适用场景

- 目标使用**私有/未公开 API 协议**
- 目标前端 SPA 与后端之间有**抗爬虫机制**（PoW、Turnstile、签名）
- 需要将私有 API 包装为**标准 OpenAI 兼容接口**
- 目标有**access_token + refresh_token** 认证体系

## 逆向方法论

### 阶段一：协议侦察
捕获关键请求：认证（login/oauth/token）、核心业务（conversation/completion/generation）、辅助（chat-requirements/sentinel/captcha）

### 阶段二：指纹伪造（以 ChatGPT 为例）
```python
fingerprint = {
    "user-agent": "Mozilla/5.0 ... Edge/143.0.0.0",
    "oai-device-id": uuid4(),
    "oai-session-id": uuid4(),
}
headers["X-OpenAI-Target-Path"] = path
```

### 阶段三：抗爬虫绕过
PoW (Proof-of-Work) + Turnstile (Cloudflare) 绕过

### 阶段四：核心协议分析
文本对话流（SSE）、图片生成协议（轮询等待）、可编辑文件生成

### 阶段五：认证管理
号池管理：多账号轮询、Token 失效检测、额度监控

## 适配层：转换为 OpenAI 兼容接口

```python
/v1/chat/completions → backend-api/conversation (streaming SSE)
/v1/images/generations → backend-api/conversation/image_gen (polling)
```

## chatgpt2api 项目架构

```
Client → API Layer (FastAPI) → Protocol Layer → Backend Layer (OpenAIBackendAPI) → ChatGPT 官网
```

## ONE App 私有协议逆向实战案例

基于 ONE·一个（成人版）Flutter App 的 API 逆向实战：
- Sign: MD5(MD5(ip.platform.ts.uk.uuid) + salt)
- AES: AES-128-CBC + PKCS7
- CDN AES: key="saIZXc4yMvq0Iz56", iv="kbJYtBJUECT0oyjo"
