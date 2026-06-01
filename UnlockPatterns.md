# 解锁模式参考（不是脚本，是写法）

## RevenueCat 解锁（单独脚本）
```
https://raw.githubusercontent.com/7452323/QuantumultX/main/script/RevenueCat.js
```
这个你已经有了，很完善，不用动。

## Apple 收据绕过（单独脚本）
```
https://raw.githubusercontent.com/7452323/QuantumultX/main/script/UniversalReceipt.js
```
这个也好了。

## 添加新App解锁（自己按需写）

参考 deezertidal 的 277 个 conf 文件模式：

```ini
# 1. 在 QX rewrite 里加一行
^https:\/\/api\.target-app\.com\/vip\/check url script-response-body https://raw.github.com/7452323/QuantumultX/main/script/Unlock.js

# 2. 在 mitm 里加域名
# hostname = api.target-app.com

# 3. 写 Unlock.js（就10行）
let obj = JSON.parse($response.body);
obj.data.is_vip = true;
obj.data.vip_expire = "2099-12-31";
$done({body: JSON.stringify(obj)});
```

## 布丁扫描（单独的）

```
https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
```
已经写好了，不需要跟别的混在一起。
