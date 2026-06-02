/*
懒饭 PRO — 会员解锁
[rewrite_local]
^https?:\/\/lanfanapp\.com\/api\/v1\/(user\/prime|recipe\/page_detail|homepage\/feed|plan\/(paged|get_quiz|group\/get_all)|story\/(get_v2|paged)|recipe\/get_last_prime_recipes) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lanfan.js

[mitm]
hostname = lanfanapp.com
*/

const url = $request.url;
let body = $response.body;
if (!body) { $done({}); }

try {
  const obj = JSON.parse(body);
  const c = obj.content;
  if (!c) { $done({body: body.replace(/"is_prime":\w+/g,'"is_prime":true').replace(/"unlocked":\w+/g,'"unlocked":true').replace(/"watch_type":\d+/g,'"watch_type":1').replace(/"is_purchased":\w+/g,'"is_purchased":true')}); }

  // user/prime — 用户会员状态
  if (url.includes('/user/prime')) {
    if (c.user) {
      c.user.is_prime = true;
      c.user.user_homepage_prime_banner = {button_text:'',text:''};
      if (c.user.prime) {
        c.user.prime.is_prime = true;
        c.user.prime.expires_time = '2099-12-31 23:59:59';
      }
    }

  // recipe/page_detail — 菜谱详情
  } else if (url.includes('/recipe/page_detail')) {
    // 主菜谱
    if (c.recipe) {
      c.recipe.unlocked = true;
      c.recipe.watch_type = 1;
      c.recipe.tips = '';
    }
    // 关联推荐
    if (c.hot_recipe_recommend_data?.recipes) {
      for (const r of c.hot_recipe_recommend_data.recipes) {
        r.unlocked = true;
        r.watch_type = 1;
        r.tips = '';
      }
    }
    // 作者会员
    if (c.note_data?.image_notes) {
      for (const n of c.note_data.image_notes) {
        if (n.user) n.user.is_prime = true;
      }
    }

  // homepage/feed — 首页列表
  } else if (url.includes('/homepage/feed')) {
    for (const feed of (c.feeds || [])) {
      const d = feed.data;
      if (!d) continue;
      // recipes 列表
      if (d.recipes) {
        for (const r of d.recipes) {
          r.unlocked = true;
          r.watch_type = 1;
          if (r.tips?.includes('会员')) r.tips = '';
        }
      }
      // stories
      if (d.stories) {
        for (const s of d.stories) s.watch_type = 1;
      }
      // 会员专属 feed
      if (d.unlocked !== undefined) d.unlocked = true;
      if (d.watch_type !== undefined) d.watch_type = 1;
      if (d.tips?.includes('会员')) d.tips = '';
    }

  // plan/paged — 训练计划
  } else if (url.includes('/plan/paged')) {
    if (c.plans) {
      for (const p of c.plans) {
        p.is_purchased = true;
        p.watch_type = 1;
      }
    }

  // get_last_prime_recipes — 推荐会员菜谱
  } else if (url.includes('/get_last_prime_recipes')) {
    if (c.recipes) {
      for (const r of c.recipes) {
        r.unlocked = true;
        r.watch_type = 1;
        r.tips = '';
      }
    }

  // story/get_v2 — 故事详情
  } else if (url.includes('/story/get_v2')) {
    if (c.story) {
      c.story.watch_type = 1;
      if (c.story.items) {
        for (const item of c.story.items) {
          if (item.data) {
            item.data.unlocked = true;
            item.data.watch_type = 1;
            item.data.tips = '';
          }
        }
      }
    }

  // story/paged — 故事列表
  } else if (url.includes('/story/paged')) {
    if (c.stories) {
      for (const s of c.stories) s.watch_type = 1;
    }
  }

  body = JSON.stringify(obj);
} catch(_) {}

$done({ body });
