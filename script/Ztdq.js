/* 字体大全 VIP 解锁
[rewrite_local]
^https:\/\/api\.yqzx8\.com\/1\.1\/functions\/vip1 url script-response-body Ztdq.js
[MITM]
hostname = api.yqzx8.com
*/
const KEY = 'JLS/W7ldTjRYvaC8KCyKUzvk';
/* 同一把 key 对应同一个 IV，明文为 {"state":"ok","result":{"com.zitidaquan.vip":{}}} */
const DATA = 'Ls/hGAJKPH9SGkRUTTj/Lm/0Ubj7TfL6OPSkAYFVoBvA4WdcmX+DQ5NoDuK1KC9NXOoWYDRKmtFbSxXHw8G1sA==';
$done({ body: JSON.stringify({ result: { key: KEY, data: DATA } }) });
