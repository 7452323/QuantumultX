/*
 * @name 懒饭 PRO
 * @description 懒饭会员解锁 - 基于抓包数据
 * @compatible QuantumultX

 [rewrite_local]
^https?:\/\/lanfanapp\.com\/api\/v1\/(user|prime|goods)\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lanfan.js

 [mitm]
 hostname = lanfanapp.com

*/

var url = $request.url;
var body = $response.body;
if (!body) { $done({}); }

try {
  var obj = JSON.parse(body);
  var future = new Date(new Date().getTime() + 365 * 50 * 86400000).toISOString();

  // 用户页面 - is_prime是关键字段
  if (obj.content && obj.content.user && obj.content.user.is_prime !== undefined) {
    obj.content.user.is_prime = true;
  }

  // 会员推广横幅 - 注入会员状态
  if (url.indexOf('/prime/') !== -1) {
    // promotion_banner返回
    if (obj.content) {
      // 标记会员专属内容为已解锁
      if (!obj.content.prime_home_category) obj.content.prime_home_category = {};
      if (obj.content.plan_list) obj.content.plan_list.promotion = "";
    }
  }

  // 菜谱列表 - unlocked字段全部设为true
  if (obj.content && obj.content.feeds) {
    for (var i = 0; i < obj.content.feeds.length; i++) {
      var feed = obj.content.feeds[i];
      if (feed.data && feed.data.recipes) {
        for (var j = 0; j < feed.data.recipes.length; j++) {
          feed.data.recipes[j].unlocked = true;
        }
      }
    }
  }

  // 单个菜谱的unlocked
  if (obj.content && obj.content.recipe_detail) {
    obj.content.recipe_detail.unlocked = true;
  }

  // 通用字段注入
  if (obj.content) {
    if (obj.content.is_prime !== undefined) obj.content.is_prime = true;
    if (obj.content.is_enjoy_discount !== undefined) obj.content.is_enjoy_discount = true;
  }

  $done({body: JSON.stringify(obj)});
} catch(e) { $done({}); }
