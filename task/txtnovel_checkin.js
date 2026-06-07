/*
书香门第签到 — 7452323 框架版
www.txtnovel.vip (Discuz dsu_paulsign)

[rewrite_local]
^http:\/\/www\.txtnovel\.vip\/ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/txtnovel_checkin.js

[task_local]
30 0 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/txtnovel_checkin.js, tag=书香门第签到, enabled=true

[MITM]
hostname = www.txtnovel.vip
*/

// ===== 框架引入 =====
// Surge/QX 环境：env_base 已注入（通过 sgmodule 前置加载）
// Node.js 测试：const EnvX = require('./env_base.js');
// 正式运行：框架模块通过 script-path 加载
const $ = new EnvX('书香门第签到', { debug: false });

const BASE = 'http://www.txtnovel.vip';
const COOKIE_KEY = 'txtnovel_cookie';

!(async () => {
  // === Cookie 采集 ===
  if (typeof $request !== 'undefined') {
    $.collect({ cookieKey: COOKIE_KEY, enable_cookie: true });
    return;
  }

  // === 签到主逻辑 ===
  const cookie = $.getdata(COOKIE_KEY);
  if (!cookie) {
    $.msg($.name, '',
      `⚠️ 未获取到 Cookie\n\n请先访问 txtnovel.vip 触发采集\n\n🎯 失败`);
    $.done();
    return;
  }

  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
  const headers = {
    'User-Agent': ua,
    'Cookie': cookie,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9'
  };

  // 1. 获取 formhash
  $.log('步骤1: 获取 formhash');
  const page = await $.httpGet(`${BASE}/plugin.php?id=dsu_paulsign:sign`, headers);
  const formhash = (page.body || '').match(/name="formhash" value="([^"]+)"/)?.[1];
  if (!formhash) {
    $.msg($.name, '',
      `👤 txtnovel.vip\n${$.ts()}  ❌ Cookie 过期\n\n🎯 失败`);
    $.done();
    return;
  }
  $.log(`formhash: ${formhash}`);

  // 2. 签到
  $.log('步骤2: 执行签到');
  const sign = await $.httpPost(
    `${BASE}/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=0&inajax=0&mobile=yes`,
    { ...headers, 'Origin': BASE, 'Referer': `${BASE}/plugin.php?id=dsu_paulsign:sign`, 'Content-Type': 'application/x-www-form-urlencoded' },
    `formhash=${formhash}&qdxq=kx`
  );
  const body = sign.body || '';
  $.log(`响应(500): ${body.substring(0, 500)}`);

  // 3. 解析结果
  const t = $.ts();
  const gained = body.match(/获得随机奖励\s*金币\s*(\d+)\s*枚/)?.[1];
  const total = body.match(/您目前获得的总奖励为:金币\s*(\d+)\s*枚/)?.[1];
  const msg = body.match(/<div class="c">([^<]+)/)?.[1];

  let notifyBody;
  if (body.includes('签到成功') || body.includes('已经签到')) {
    const detail = [];
    if (gained && total) detail.push(`💰 +${gained} 金币  |  总计 ${total} 金币`);
    else if (msg) detail.push(`💬 ${msg}`);
    notifyBody = `👤 txtnovel.vip\n${t}  ✅ 签到成功${detail.length ? '\n' + detail[0] : ''}\n\n🎯 已完成`;
  } else {
    const err = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200);
    notifyBody = `👤 txtnovel.vip\n${t}  ❌ 签到失败\n💬 ${err}\n\n🎯 失败`;
  }

  $.msg($.name, '', notifyBody);
  $.done();
})().catch(e => { $.logErr(e); $.done(); });
