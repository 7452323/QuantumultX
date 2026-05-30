//试试双拼 - Shuangpin PRO解锁
//QX Rewrite脚本
//配合MITM域名: ulpb.app

const url = $request.url;
const method = $request.method;
const headers = $request.headers;

if (url.includes('/api/subscription') || url.includes('/api/user') || url.includes('/api/profile') || url.includes('/receipt') || url.includes('/verify')) {
  if (method === 'GET') {
    let body = $response.body;
    if (body) {
      try {
        let obj = JSON.parse(body);
        // 通用PRO解锁
        if (obj.data) obj.data.isPro = true;
        if (obj.data) obj.data.is_premium = true;
        if (obj.data) obj.data.pro_expires_at = "2099-12-31T23:59:59Z";
        if (obj.data) obj.data.subscription_status = "active";
        if (obj.pro) obj.pro = true;
        if (obj.is_premium) obj.is_premium = true;
        if (obj.subscription) obj.subscription = "active";
        body = JSON.stringify(obj);
      } catch(e) {}
      $done({body});
    } else {
      $done({});
    }
  } else if (method === 'POST') {
    let body = $response.body;
    if (body) {
      try {
        let obj = JSON.parse(body);
        obj.isPro = true;
        obj.is_premium = true;
        obj.subscription_status = "active";
        body = JSON.stringify(obj);
      } catch(e) {}
      $done({body});
    } else {
      $done({});
    }
  } else {
    $done({});
  }
} else {
  $done({});
}
