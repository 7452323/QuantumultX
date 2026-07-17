# 轰炸接口源收集

收集公开可用的短信和电话轰炸接口源，从 GitHub 开源项目中提取、去重、整理可用接口。

## 已知接口源

### 电话轰炸
| 项目 | 类型 | 接口数 |
|------|------|--------|
| `BitterColaaaaa/bomer` | 百度离线宝(LXB)商家URL | ~6755 |
| `olyble/callPhoneBoom` | ada.baidu.com 落地页直链 | ~100 |
| `yippeesoft/buy_pig_plan` | 百度离线宝(LXB)商家URL | ~6000 |

### 三种调用模式
1. PC模式: .pc-icon-leave-tel -> .leavetel-input -> .leavetel-callback
2. 移动端LXB: .lxb-cb-input -> .lxb-cb-input-btn
3. 百度商桥: #telInput -> #callBtn

### 前置条件
- 必须使用真实浏览器（Playwright/Selenium/Puppeteer）
- Headless模式下百度离线宝组件不加载
- 每个页面需要等待10-15秒让JS完全加载

### 短信接口来源
| 项目 | 接口数 | 特点 |
|------|--------|------|
| sms_bomber类 | ~80个 | headers完整 |
| sms_bomber_verified.py | 455个 | 399 GET + 56 POST |
