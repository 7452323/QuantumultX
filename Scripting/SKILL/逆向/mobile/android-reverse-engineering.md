---
name: android-reverse-engineering
description: "Android应用逆向工程全流程。APK反编译、smali分析、Frida动态Hook、JNI/SO分析、脱壳、混淆对抗。"
license: MIT
---

# Android逆向工程

## 工具链

| 工具 | 安装 | 用途 |
|------|------|------|
| jadx | `brew install jadx` | APK-Java反编译 |
| apktool | `brew install apktool` | APK解包/重打包/smali |
| Frida | `pip install frida-tools` | 动态Hook框架 |
| Ghidra | 下载安装 | SO原生库分析 |
| dex2jar | GitHub releases | DEX-JAR转换 |

## 工作流程

### Phase 1: 信息收集
```bash
apktool d app.apk -o app_decoded/
jadx -d app_java/ app.apk
cat app_decoded/AndroidManifest.xml
```

### Phase 2: 静态分析
```bash
grep -r "password\|token\|secret\|api_key" app_java/
grep -rn "https\?://" app_java/ --include="*.java"
grep -rn "AES\|RSA\|DES\|Cipher" app_java/
```

### Phase 3: 动态分析（Frida）
```javascript
Java.perform(function() {
    var Cipher = Java.use("javax.crypto.Cipher");
    Cipher.doFinal.overload('[B').implementation = function(input) {
        console.log("Input: " + bytesToHex(input));
        return this.doFinal(input);
    };
});
```

### Phase 4: 脱壳（如果加壳）
FART脱壳 / Frida脱壳脚本 / BlackDex

### Phase 5: 重打包
```bash
apktool b app_decoded/ -o app_modified.apk
jarsigner -keystore my.keystore app_modified.apk alias_name
```

## 常见场景

### 场景1: 提取API接口
```bash
grep -rn "Retrofit\|OkHttp\|Volley" app_java/
grep -rn "@GET\|@POST\|@PUT\|@DELETE" app_java/
```

### 场景2: 绕过root检测
```javascript
Java.perform(function() {
    var RootChecker = Java.use("com.scottyab.rootbeer.RootBeer");
    RootChecker.isRooted.implementation = function() { return false; };
});
```

## 注意事项

1. **法律合规**：仅对有授权的应用进行逆向分析
2. **环境隔离**：在模拟器或隔离设备中分析恶意应用
3. **版本差异**：不同Android版本API差异大
4. **64位优先**：优先分析arm64-v8a架构的SO库
