/*
UnlockCore — 通用解锁框架
融合 RevenueCat + UniversalReceipt + JSON/Protobuf 多层解锁

[rewrite_local]
^https:\/\/api\.revenuecat\.com\/v1\/(receipts|subscribers) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/UnlockCore.js
^https:\/\/api\.revenuecat\.com\/v1\/(receipts|subscribers) url script-request-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/UnlockCore.js
^https:\/\/buy\.itunes\.apple\.com\/verifyReceipt url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/UnlockCore.js

[mitm]
hostname = api.revenuecat.com, buy.itunes.apple.com
*/

// ======== 平台检测 ========
const UA = $request ? ($request.headers ? ($request.headers['User-Agent'] || $request.headers['user-agent'] || '') : '') : ''
const PLATFORM = typeof $task !== 'undefined' ? 'QX' :
                 typeof $httpClient !== 'undefined' ? 'Surge' :
                 typeof $loon !== 'undefined' ? 'Loon' :
                 typeof $stash !== 'undefined' ? 'Stash' : 'Unknown'

console.log = (msg) => { if (typeof $task !== 'undefined') $task.info(msg) }

// ======== 收入猫产品ID ========
const SUBSCRIPTION_PRODUCTS = [
  'VIP.1month', 'sub_1month', 'monthly', 'com.xxx.monthly',
  'VIP.1year', 'sub_1year', 'yearly', 'com.xxx.yearly',
  'VIP.Lifetime', 'lifetime', 'life', 'com.xxx.lifetime',
  'com.weibai.scanner.viper888_B', // 布丁扫描终身
]

const LIFETIME_PRODUCTS = [
  'VIP.Lifetime', 'lifetime', 'life',
  'com.xxx.lifetime', 'com.xxx.viper888',
  'com.weibai.scanner.viper888_B',
]

const ENTITLEMENTS = ['pro', 'premium', 'vip', 'gold', 'all_access', 'full']

// ======== 核心解锁函数 ========

// RevenueCat v1 (API.revenuecat.com)
function unlockRevenueCat(body, isRequest) {
  let obj = JSON.parse(body)
  
  if (isRequest) {
    // 请求体：伪造收据
    obj = fakeReceipt(obj)
    return JSON.stringify(obj)
  }
  
  // 响应体：伪造订阅状态
  const subscriber = obj.data || obj.subscriber || obj
  const app_user_id = subscriber.original_app_user_id || subscriber.subscriber?.original_app_user_id || 'unknown'
  
  // 构建伪造订阅数据
  const now = Date.now()
  const future = 4092599349000 // 2099-10-01 毫秒
  
  const fakeSubscriptions = {}
  const fakeNonSubscriptions = {}
  const fakeEntitlements = {}
  
  // 为每个产品ID生成伪造订阅
  for (const pid of SUBSCRIPTION_PRODUCTS) {
    fakeSubscriptions[pid] = {
      expires_date: '2099-12-31T23:59:59Z',
      purchase_date: new Date(now).toISOString(),
      original_purchase_date: new Date(now - 86400000).toISOString(),
      store: 'app_store',
      is_sandbox: false,
      ownership_type: 'PURCHASED',
      period_type: pid.toLowerCase().includes('life') ? 'lifetime' : 'active',
      auto_resume_date: null,
      unsubscribe_detected_at: null
    }
    
    fakeNonSubscriptions[pid] = {
      id: `mock_${pid}_${now}`,
      purchase_date: new Date(now).toISOString(),
      original_purchase_date: new Date(now - 86400000).toISOString(),
      store: 'app_store',
      is_sandbox: false,
      ownership_type: 'PURCHASED',
      period_type: 'normal'
    }
  }
  
  // 为每个entitlement key生成
  for (const ent of ENTITLEMENTS) {
    fakeEntitlements[ent] = {
      expires_date: '2099-12-31T23:59:59Z',
      product_identifier: LIFETIME_PRODUCTS[0],
      purchase_date: new Date(now - 86400000).toISOString()
    }
  }
  
  // 合并到响应
  if (obj.subscriber) {
    obj.subscriber.subscriptions = { ...obj.subscriber.subscriptions, ...fakeSubscriptions }
    obj.subscriber.non_subscriptions = { ...obj.subscriber.non_subscriptions, ...fakeNonSubscriptions }
    obj.subscriber.entitlements = { ...obj.subscriber.entitlements, ...fakeEntitlements }
  } else {
    obj.subscriber = {
      original_app_user_id: app_user_id,
      first_seen: new Date(now - 86400000).toISOString(),
      last_seen: new Date(now).toISOString(),
      management_url: 'https://apps.apple.com/account/subscriptions',
      subscriptions: fakeSubscriptions,
      non_subscriptions: fakeNonSubscriptions,
      entitlements: fakeEntitlements
    }
  }
  
  return JSON.stringify(obj)
}

// Apple Universal Receipt 绕过
function unlockAppleReceipt(body) {
  let obj = JSON.parse(body)
  
  // status=0 表示收据有效
  obj.status = 0
  obj.environment = 'Production'
  
  // 伪造收据信息
  if (!obj.receipt) obj.receipt = {}
  obj.receipt.receipt_type = 'Production'
  obj.receipt.adam_id = 0
  obj.receipt.app_item_id = 0
  obj.receipt.bundle_id = obj.receipt.bundle_id || 'com.xxx.app'
  obj.receipt.application_version = '1.0'
  obj.receipt.original_application_version = '1.0'
  obj.receipt.in_app = [{
    quantity: '1',
    product_id: LIFETIME_PRODUCTS[0],
    transaction_id: 'mock_txn_1000000001',
    original_transaction_id: 'mock_orig_1000000001',
    purchase_date: new Date().toISOString(),
    purchase_date_ms: Date.now().toString(),
    purchase_date_pst: new Date().toISOString(),
    original_purchase_date: new Date(Date.now() - 86400000).toISOString(),
    original_purchase_date_ms: (Date.now() - 86400000).toString(),
    is_trial_period: 'false',
    expires_date: '2099-12-31T23:59:59Z',
    expires_date_ms: '4092599349000'
  }]
  
  // 最新收据信息
  obj.latest_receipt_info = obj.receipt.in_app
  obj.latest_receipt = 'mock_latest_receipt'
  
  // 到期续费信息
  obj.pending_renewal_info = [{
    auto_renew_product_id: LIFETIME_PRODUCTS[0],
    original_transaction_id: 'mock_orig_1000000001',
    product_id: LIFETIME_PRODUCTS[0],
    auto_renew_status: '1'
  }]
  
  return JSON.stringify(obj)
}

// ======== 个性化App解锁模式 ========

const APP_UNLOCK = {
  // 布丁扫描 (Bdsm)
  'budingscan.com': (body) => {
    let obj = JSON.parse(body)
    let url = $request.url
    
    if (url.includes('/get_user_config')) {
      obj.result = { ...obj.result,
        user_type: 3,
        subscribe_pay_type: 0,
        renewal_status: 0,
        subscribe_plan_validity: 36500,
        subscribe_plan_name: '终身会员',
        end_time: '2099-12-31',
        total_storage: 999999999,
        vip_storage: 999999999,
        used_storage: 0,
        oral: 1
      }
    } else if (url.includes('/payment/paid_modules')) {
      obj.result = (obj.result || []).map(m => ({
        ...m, usage_limit: -1, vip_usage_limit: -1
      }))
    } else if (url.includes('/payment/plans') || url.includes('/payment/questions')) {
      obj.result = (obj.result || []).filter(p => p.plan_renewal_status !== 1)
    } else if (url.includes('dashboardBanner')) {
      obj.result = { banners: [] }
    } else if (url.includes('/get_remain_paint_count')) {
      obj.data = { count: 99999 }
    } else if (url.includes('/get_remain_photo_shoot_count')) {
      obj.data = { count: 99999, history_count: 0 }
    } else if (url.includes('/self_homepage')) {
      obj.data.count_remain = 99999
      obj.data.count_used = 0
    }
    return JSON.stringify(obj)
  },
  
  // 模板：添加新App
  'template': (body) => {
    let obj = JSON.parse(body)
    // let url = $request.url
    // 响应修改逻辑写在下面
    return JSON.stringify(obj)
  }
}

// ======== App匹配器 ========
function getUnlockHandler(url) {
  const hostnames = Object.keys(APP_UNLOCK)
  for (const host of hostnames) {
    if (url.includes(host)) return APP_UNLOCK[host]
  }
  return null
}

// ======== 入口 ========
try {
  let body = $response.body
  let url = $request.url
  let isRequest = url.includes('/receipts') && $request.body
  
  // RevenueCat 解锁
  if (url.includes('revenuecat.com')) {
    body = unlockRevenueCat(body, isRequest)
  }
  // Apple 收据绕过
  else if (url.includes('buy.itunes.apple.com') || url.includes('sandbox.itunes.apple.com')) {
    body = unlockAppleReceipt(body)
  }
  // App自定义解锁
  else {
    const handler = getUnlockHandler(url)
    if (handler) {
      body = handler(body)
    }
  }
  
  $done({ body })
} catch (e) {
  console.log('UnlockCore error: ' + e)
  $done({})
}
