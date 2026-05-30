/*
 * @name 懒饭 PRO
 * @description 懒饭会员解锁
 * @compatible QuantumultX

 [rewrite_local]
^https?:\/\/api\.xiachufang\.com\/v\/[a-z]\/(member|user|subscribe|order|vip)\/ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lanfan.js

 [mitm]
 hostname = api.xiachufang.com

*/

var url = $request.url;
var body = $response.body;
if (!body) { $done({}); }

try {
  var obj = JSON.parse(body);
  var now = new Date();
  var future = new Date(now.getTime() + 365 * 50 * 86400000);
  var futureStr = future.toISOString().replace('Z', '+08:00');

  var vip = {
    status: "active",
    is_vip: true, isVip: true, is_member: true, isMember: true,
    vip: true, member: true, premium: true,
    vip_type: "year", member_type: "year",
    expire_time: futureStr, expireTime: futureStr,
    expired_at: futureStr, expiresAt: futureStr,
    expired_date: futureStr,
    level: "vip",
    lifetime: false
  };

  for (var k in vip) {
    if (obj[k] !== undefined) obj[k] = vip[k];
    if (obj.data && obj.data[k] !== undefined) obj.data[k] = vip[k];
    if (obj.result && obj.result[k] !== undefined) obj.result[k] = vip[k];
  }
  if (obj.data) { obj.data.isVip = true; obj.data.is_vip = true; }
  if (obj.result) { obj.result.isVip = true; }

  $done({body: JSON.stringify(obj)});
} catch(e) { $done({}); }
