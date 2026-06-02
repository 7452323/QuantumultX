/*
 * @name RevenueCat 主机名通杀（双模版）
 * @description 先按 App 原本的数据只改时间；如果 App 没数据或数据为空，
 *              再用 UAMappings（从 Yu9191 + 社区收集）匹配补全。
 *              兼容 QuantumultX / Loon / Surge / Stash / Shadowrocket
 * @author Akino
 *
[rewrite_local]
# ===== QX =====
^https?:\/\/([a-z0-9-]+\.)*revenuecat\.com\/(v[12]\/)?(receipts$|subscribers\/[^?#]+) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/RevenueCat.js
^https?:\/\/([a-z0-9-]+\.)*rc-backup\.com\/(v[12]\/)?(receipts$|subscribers\/[^?#]+) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/RevenueCat.js
# 清理 ETag
^https?:\/\/([a-z0-9-]+\.)*(revenuecat|rc-backup)\.com\/(v[12]\/)?(receipts$|subscribers\/[^?#]+) url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/RevenueCat.js

[mitm]
hostname = *.revenuecat.com, *.rc-backup.com
*/
(function() {
  var futureMs = "2099-12-31T23:59:59.000000Z";
  var futureDate = "2099-12-31T23:59:59Z";

  // ----- request-header 分支：删 ETag -----
  if (typeof $response == "undefined") {
    delete $request.headers["x-revenuecat-etag"];
    delete $request.headers["X-RevenueCat-ETag"];
    delete $request.headers["if-none-match"];
    delete $request.headers["If-None-Match"];
    $done({ headers: $request.headers });
    return;
  }

  // ----- response-body 分支 -----
  try {
    var body = JSON.parse($response.body);
    if (!body || !body.subscriber) { $done({}); return; }
    var sub = body.subscriber;

    // ========== 模式 A：App 有数据 → 原样只改时间 ==========
    function patchData(obj) {
      if (!obj || typeof obj !== "object") return;
      for (var k in obj) {
        var v = obj[k];
        if (v && typeof v === "object" && v.expires_date) {
          v.expires_date = futureMs;
          v.is_sandbox = false;
          v.unsubscribe_detected_at = null;
          v.billing_issues_detected_at = null;
          v.refunded_at = null;
          if (v.grace_period_expires_date) v.grace_period_expires_date = null;
        }
      }
    }

    var hasRealData = false;
    if (sub.subscriptions) {
      for (var k in sub.subscriptions) {
        if (sub.subscriptions[k] && sub.subscriptions[k].expires_date) hasRealData = true;
      }
    }
    if (sub.entitlements) {
      for (var k in sub.entitlements) {
        if (sub.entitlements[k] && sub.entitlements[k].expires_date) hasRealData = true;
      }
    }

    if (hasRealData) {
      patchData(sub.subscriptions);
      patchData(sub.entitlements);
      $done({ body: JSON.stringify(body) });
      return;
    }

    // ========== 模式 B：没数据 → 用 UAMappings 匹配 ==========
    var UA = $request.headers["User-Agent"] || $request.headers["user-agent"] || "";

    var UAMappings = {
      'Pocket%20Widgets':{name:'Subscription',id:'com.niko.PocketWidgetsApp.lifetimePlus'},
      'ClipyBoard':{name:'premium',id:'clipyboard_yearly'},
      'Wake%20Music':{name:'premium',id:'com.OfflineMusic.www.lifetime298'},
      'Spark':{name:'premium',id:'spark_c_5999_1y_d50'},
      'Barcodes':{name:'Unlimited',id:'com.barcodesapp.lifetime'},
      'Relax':{name:'pro',id:'com.happydogteam.relax.lifetimePro'},
      'Nightcam':{name:'nightcam_pro',id:'com.ahmetserdarkaradeniz.nightcamyearlyalternative'},
      'Jellycuts':{name:'pro',id:'standart'},
      'Finale%E2%80%A2Pad':{name:'Pro',id:'com.cherpake.finale.lt'},
      'outside':{name:'Outside Pro',id:'outside_sub_yearly_super_cheap_free_trial'},
      'Sibelius%E2%80%A2Pad':{name:'Premium',id:'com.cherpake.musicpad.all'},
      'NumPad':{name:'Pro',id:'com.cherpake.numpad.pro.discount'},
      'Drive':{name:'Pro',id:'com.cherpake.drive.viewer.free'},
      'TV%20Remote':{name:'Pro',id:'com.cherpake.tvr.all.discount'},
      'Chatty':{name:'pro AI Pro',id:'chatty.yearly.1'},
      'ainotes':{name:'HoneyNote AI Pro',id:'NCIAP_A_149_99'},
      'quitnow':{name:'pro_features',id:'pro_features_year_subscription'},
      'ChatPub':{name:'Unlimited Access',id:'conversationai.year'},
      'Unfold':{name:'FF2_STORY',id:'UNFOLD_PRO_YEARLY'},
      'Origami':{name:'Premium',id:'origami_499_1m'},
      'Treering':{name:'Pro',id:'Treering.pro.yearly1'},
      'AmazingWidget':{name:'pro',id:'com.moyo.forever.vip'},
      'dtdVibe':{name:'pro',id:'com.dtd.aroundu.year'},
      'AdGuard%20Home%20Remote':{name:'aghrpro',id:'adguard.home.remote.pro'},
      'Chatme':{name:'premium',id:'chatme_premium_year_discount'},
      'Alpenglow':{ name: 'newPro', id: 'ProLifetime'},
      'Opal':{ name: 'premium_tier_2', id: 'com.withopal.opal.premiumtier2lifetime'},
      'Photoooo':{ name: 'lifetime', id: 'canoe_28_rnb_forever'},
      'Baby%20Generator':{ name: 'premium_features', id: 'babygenerator_499_weekly'},
      'Snipd':{ name: 'premium', id: 'test_snipd_premium_grandfather_1y_4200_trial_2w_v1'},
      'iScape':{ name: 'Pro', id: 'Limited_YearlyProAutoRenew'},
      'GigaBody':{ name: 'Pro', id: 'GigaBodySubscriptionYear_v1'},
      'FunPix':{ name: 'premium', id: 'intro_price_weekly'},
      'WiseMate':{ name: 'vip_entitlement', id: 'wisemate.ai.ios.week'},
      'Loora':{ name: 'Yearly', id: 'yearly_119_99_no_trial'},
      'Reader':{name:'standard',id:'vd_monthly_999'},
      'Vocai-iOS':{name:'AI Pro',id:'vocabAI_900_1m'},
      'Gradient':{ name: 'unlimited', id: 'com.tickettothemoon.gradient.unlimited.yearly.small'},
      'Python3IDE':{ name: 'pro', id: 'python3ide_six_month'},
      'Scale%20Finder':{ name: 'Pro', id: 'sf_2999_1y_1w0'},
      'PrevisShot':{ name: 'VIP', id: 'com.previsshot.previsshot.continuous_subscribe_12month_vip'},
      'MusicPutty':{ name: 'pro_version', id: 'mp_3599_1y'},
      'Linearity':{ name: 'pro', id: 'linearity_curve_pro_yearly_special_offer_trial'},
      'iplayTV':{ name: 'com.ll.btplayer.12', id: 'com.ll.btplayer.12'},
      'DHWaterMarkManager':{ name: 'Vip', id: 'lifetimeVIP_001'},
      'FretTrainer':{ name: 'pro', id: 'frettrainer.sub.yearly.pro'},
      'PeachTree':{ name: 'GoldMember', id: 'LifetimeGoldMembership'},
      'No%20Fusion':{ name: 'LivePhoto', id: 'com.grey.livephoto.reference.price'},
      'VOX':{ name: 'VOX Premium', id: 'com.coppertino.VoxMobile.AU.Loop1_v8'},
      'PDF%20Viewer':{ name: 'sub.pro', id: 'com.pspdfkit.viewer.sub.pro.yearly'},
      'Text%20Workflow':{ name: 'pro', id: 'tw_99_1m'},
      'FoJiCam':{ name: 'ProVersionLifeTime', id: 'com.uzero.cn.fojicam.life2'},
      'ShellBoxKit':{ name: 'pro', id: 'ShellBoxKit.Lifetime'},
      'PicSeedClient':{ name: 'Pro', id: 'com.picseed.sub.pro.monthly'},
      'StarDiary':{ name: 'pro', id: 'com.gsdyx.StarDiary.nonConsumable.forever'},
      'StarFocus':{ name: 'pro', id: 'com.gsdyx.StarFocus.nonConsumable.forever'},
      'Context_iOS':{ name: 'pro', id: 'ctx_3y_sspai_preorder_angel'},
      'Vision':{ name: 'promo_3.0', id: 'vis_lifetime_3.0_promo'},
      'Structured':{ name: 'pro', id: 'today.structured.pro'},
      'Cookie':{ name: 'allaccess', id: 'app.ft.Bookkeeping.lifetime'},
      'HTTPBot':{ name: 'Pro', id: 'httpbot_1499_1y_1w0'},
      'MyPianist':{ name: 'pro', id: 'com.collaparte.mypianist.pro.gift.twelve'},
      'TouchRetouchBasic':{ name: 'premium', id: 'tr5_yearlysubsc_30_and_20_dlrs'},
      'AnkiPro':{ name: 'Premium', id: 'com.ankipro.app.lifetime'},
      'AIChat':{ name: 'AI Plus', id: 'aiplus_yearly'},
      'SmartAIChat':{ name: 'Premium', id: 'sc_3999_1y'},
      'AIKeyboard':{ name: 'plus_keyboard', id: 'aiplus_keyboard_yearly'},
      'TextMask':{ name: 'pro', id: 'tm_lifetime'},
      'MusicMate':{ name: 'premium', id: 'mm_lifetime_68_premium'},
      'ImagineAI':{ name: 'pro', id: 'artistai.yearly.1'},
      'VoiceAI':{ name: 'Special Offer', id: 'voiceannualspecial'},
      'Langster':{ name: 'Premium', id: 'com.langster.universal.lifetime'},
      'Readle':{ name: 'Premium', id: 'com.hello.german.yearly'},
      'Muse':{ name: 'pro', id: 'monthly_pro_muse'},
      'Funexpected%20Math':{ name: 'plus', id: 'Plus6Months14DaysTrial'},
      'Law':{ name: 'vip', id: 'LawVIPOneYear'},
      'HabitKit':{ name: 'Pro', id: 'habitkit_1799_lt'},
      'Liftbear':{ name: 'Pro', id: 'liftbear_2399_1y'},
      'VSCO':{name:'pro',id:'vscopro_global_5999_annual_7D_free'},
      'Pillow':{name:'premium',id:'com.neybox.pillow.premium.yearly'},
      // === 额外补充 ===
      'ScannerPro':{name:'pro',id:'com.tapzapp.scannerpro.yearly'},
      'BabyTrax':{name:'premium',id:'com.nighp.babytrax.premium'},
      'Cardiogram':{name:'premium',id:'cardiogram.premium.yearly'},
      'Streaks':{name:'premium',id:'com.streaksapp.premium.yearly'},
      'WaterMinder':{name:'premium',id:'waterminder_premium_yearly'},
      'AutoSleep':{name:'premium',id:'com.autosleep.premium'},
      'CarrotWeather':{name:'premium',id:'carrot.weather.premium.yearly'},
      'Fantastical':{name:'premium',id:'com.flexibits.fantastical2.ios.premium.yearly'},
      'Things3':{name:'pro',id:'com.culturedcode.Things3.premium.yearly'},
    };

    var matched = false;
    for (var key in UAMappings) {
      var escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%20/g, '\\s*');
      if (new RegExp(escaped, 'i').test(UA)) {
        var m = UAMappings[key];
        var productId = m.id;
        var entitlementName = m.name;

        sub.subscriptions = {};
        sub.subscriptions[productId] = {
          expires_date: futureMs,
          original_purchase_date: "2023-01-01T00:00:00Z",
          purchase_date: "2024-01-01T00:00:00Z",
          ownership_type: "PURCHASED",
          store: "app_store",
          is_sandbox: false,
          unsubscribe_detected_at: null,
          billing_issues_detected_at: null
        };

        sub.entitlements = {};
        sub.entitlements[entitlementName] = {
          expires_date: futureMs,
          grace_period_expires_date: null,
          purchase_date: "2024-01-01T00:00:00Z",
          product_identifier: productId,
          product_plan_identifier: null
        };

        matched = true;
        break;
      }
    }

    // 仍没匹配：生成通用 pro
    if (!matched) {
      sub.subscriptions = {};
      sub.subscriptions["com.rc.universal.pro.yearly"] = {
        expires_date: futureMs, original_purchase_date: "2023-01-01T00:00:00Z",
        purchase_date: "2024-01-01T00:00:00Z", ownership_type: "PURCHASED",
        store: "app_store", is_sandbox: false
      };
      sub.entitlements = {};
      sub.entitlements["pro"] = {
        expires_date: futureMs, product_identifier: "com.rc.universal.pro.yearly",
        purchase_date: "2024-01-01T00:00:00Z"
      };
    }

    body.subscriber = sub;
    $done({ body: JSON.stringify(body) });

  } catch (e) {
    $done({});
  }
})();
