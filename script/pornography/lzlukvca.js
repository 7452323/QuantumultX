/* 
黄豆短剧 金币播放破解 → 无限制免费看剧

[rewrite_local]
^https?://[a-z0-9-]+\\.[a-z]+/api/drama/play url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/pornography/lzlukvca.js
^https?://[a-z0-9-]+\\.[a-z]+/api/drama/detail url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/pornography/lzlukvca.js

[mitm]
hostname = *.hddj05.com, *.hddj06.com, *.hddj07.com, *.hdmgdj.com, *.fsbd.yskkkkb.me
*/

(function() {
    'use strict';

    let body;
    try {
        body = JSON.parse($response.body);
    } catch (e) {
        $done({});
        return;
    }

    if (!body || typeof body !== 'object') {
        $done({});
        return;
    }

    function unlock(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach(unlock); return; }

        // 扣币清零
        if ('coin_consume_amount' in obj) obj.coin_consume_amount = 0;
        if ('cost_gold' in obj) obj.cost_gold = 0;
        if ('consume_amount' in obj) obj.consume_amount = 0;
        if ('amount' in obj) obj.amount = 0;

        // 余额设大
        if ('coin_balance_before' in obj) obj.coin_balance_before = 999999;
        if ('coin_balance_after' in obj) obj.coin_balance_after = 999999;
        if ('coin_quantity' in obj) obj.coin_quantity = 999999;
        if ('today_coin' in obj) obj.today_coin = 999999;
        if ('total_coin' in obj) obj.total_coin = 999999;
        if ('gold_balance' in obj) obj.gold_balance = 999999;
        if ('min_price_coin' in obj) obj.min_price_coin = 0;
        if ('max_reward_coin' in obj) obj.max_reward_coin = 999999;
        if ('pending_coin' in obj) obj.pending_coin = 0;

        // 解锁标记
        if ('is_free' in obj) obj.is_free = 1;
        if ('is_coin' in obj) obj.is_coin = 0;
        if ('need_coin' in obj) obj.need_coin = 0;
        if ('is_locked' in obj) obj.is_locked = 0;
        if ('locked' in obj) obj.locked = false;
        if ('need_pay' in obj) obj.need_pay = false;
        if ('is_pay' in obj) obj.is_pay = 1;
        if ('is_vip' in obj) obj.is_vip = true;
        if ('vip' in obj) obj.vip = true;

        for (var key in obj) {
            if (obj[key] && typeof obj[key] === 'object') unlock(obj[key]);
        }
    }

    unlock(body);
    $done({body: JSON.stringify(body)});
})();
