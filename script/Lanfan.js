/*
 * @name 懒饭 PRO
 * @description 懒饭会员解锁 - is_prime + is_purchased + unlocked
 * @compatible QuantumultX

 [rewrite_local]
^https?:\/\/lanfanapp\.com\/api\/v1\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lanfan.js

 [mitm]
 hostname = lanfanapp.com

*/

var url = $request.url;
var body = $response.body;
if (!body) { $done({}); }

try {
  var obj = JSON.parse(body);

  // 工具函数：递归遍历所有字段
  function fixVip(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (var k in obj) {
      var v = obj[k];
      if (k === 'is_prime' || k === 'is_purchased') {
        obj[k] = true;
      } else if (k === 'unlocked') {
        obj[k] = true;
      } else if (k === 'watch_type') {
        obj[k] = 1;
      } else if (typeof v === 'object') {
        fixVip(v);
      }
    }
  }

  fixVip(obj);

  // 用户页面 - is_prime
  if (obj.content && obj.content.user) {
    obj.content.user.is_prime = true;
  }

  $done({body: JSON.stringify(obj)});
} catch(e) { $done({}); }
