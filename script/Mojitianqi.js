/*

[rewrite_local]
^https?:\/\/[^\/]+\.api\.moji\.com\/(sns\/json\/profile\/get_info.*|json\/member_new\/homepage_info.*|user\/personal\/json\/profile.*|flycard\/novice|shortvideo\/.*) url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Mojitianqi.js

[mitm]
hostname = *.api.moji.com

*/

let obj = JSON.parse($response.body)
let url = $request.url

const longExpire = 4092599349000
const dateStr = "2099-09-09到期"

if (url.includes("/sns/json/profile/get_info")) {
  obj.is_vip = 1
  obj.type = 7
  obj.grade = 1
  obj.is_adver_free = 1
  obj.expire_time = longExpire
  obj.member_type = 1
  obj.member_level = 1
  obj.max_expiration_days = 9999999
  obj.is_expire = 0
  obj.remain_day = 9999999
  obj.inkrity = 9999999
  obj.status = 1
  obj.is_purchase = true
}

if (url.includes("/json/member_new/homepage_info")) {
  obj.userTips = [dateStr]
  obj.user_tips = [dateStr]
  obj.is_member = true
  if (obj.user_member_info) {
    obj.user_member_info.vip = 1
    obj.user_member_info.is_auto_member = 1
    obj.user_member_info.expire_time = longExpire
  }
}

if (url.includes("/user/personal/json/profile")) {
  if (obj.personal_profile) {
    obj.personal_profile.inkrity = 9999999
    obj.personal_profile.is_vip = true
    obj.personal_profile.grade = 1
    obj.personal_profile.user_flag = true
    obj.personal_profile.vip_expire_time = longExpire
  }
}

if (url.includes("/flycard/novice")) {
  if (obj.data?.novice) {
    obj.data.novice.adShow = 0
    obj.data.novice.expireTime = longExpire
    obj.data.novice.vipShow = 1
  }
}

if (url.includes("/shortvideo")) {
  obj.item_list = []
  obj.rcmList = []
  obj.add_card_list = []
  obj.feeds = []
}

$done({ body: JSON.stringify(obj) })