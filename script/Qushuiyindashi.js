/*

当前版本 2.1

https://apps.apple.com/cn/app/%E5%8E%BB%E6%B0%B4%E5%8D%B0%E5%A4%A7%E5%B8%88-%E7%9F%AD%E8%A7%86%E9%A2%91%E7%BC%96%E8%BE%91%E5%8A%A9%E6%89%8B/id1424012935

[rewrite_local]
^https:\/\/wx\.520gyh\.com\/Unmark\/Login\/wxUserInfo url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Qushuiyindashi.js
^https:\/\/wx\.520gyh\.com\/Unmark\/Login\/wxLoginMarking url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Qushuiyindashi.js
^https:\/\/wx\.520gyh\.com\/Unmark\/Login\/deviceLogin url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Qushuiyindashi.js
^https:\/\/wx\.520gyh\.com\/Unmark\/Index\/appCfg url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Qushuiyindashi.js

[mitm]
hostname = wx.520gyh.com

*/

let body = $response.body;
let obj = JSON.parse(body);

if (obj.vipInfo) {
    obj.vipInfo.vip_exp = 999999999;
    obj.vipInfo.coins = 99999;     
    obj.vipInfo.unmark = 1;
    obj.vipInfo.out_time = "2099-12-31 23:59:59";
}

if (obj.userInfo) {
    obj.userInfo.nickName = "One more time";
    obj.userInfo.coin = "99999";    
}

if (obj.cfg) {
    obj.cfg.freeVip = 1;
    obj.cfg.unmark = 1;
    obj.cfg.canUnmarkAd = 0;
    obj.cfg.showGAD = 0;
    obj.cfg.freeCount = "9999";
    obj.cfg.vip_arr = ["永久会员\n已激活\n(99999钻)"];
    obj.cfg.oneMonth = 99999;
    obj.cfg.scoreTips = "永久会员已解锁 🎉";
    obj.cfg.scroll_msg = ["欢迎您，永久会员已生效！"];
}

$done({ body: JSON.stringify(obj) });