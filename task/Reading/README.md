/*
------------------------------------------
@Description: 微信读书 全功能自动化配置
@Author: 7452323
@Source: 脚本来源:TomCatXue (https://github.com/TomCatXue/MyCookieCenter)
@Github: https://github.com/7452323/QuantumultX
------------------------------------------

# QuantumultX

[task_local]
0 23 * * ? https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Reading/weread_claim.js, tag=微信读书·每日领取, enabled=true
0 20 * * 2 ? https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Reading/weread_flip.js, tag=微信读书·周二翻牌, enabled=true
0 10 * * 5 ? https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Reading/weread_free.js, tag=微信读书·周五限免, enabled=true

[rewrite_local]
^https?:\/\/(i\.)?weread\.qq\.com\/(flip-card-game|user\/|feature|free\/library|checkfreequalify) url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Reading/weread_cookie.js
^https?:\/\/i\.weread\.qq\.com\/login url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Reading/weread_cookie.js
^https?:\/\/i\.weread\.qq\.com\/login url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Reading/weread_cookie.js

[MITM]
hostname = weread.qq.com, i.weread.qq.com
*/
