#!/usr/bin/env python3
"""
句读 (JudouRili 5.0.8) MITM 篡改脚本
配合 mitmdump 使用: mitmdump -s jd_mitm.py -p 8080

部署: 服务器 198.46.189.141:8080 已运行
证书: ~/.mitmproxy/mitmproxy-ca-cert.pem
"""
import json


def response(flow):
    """Modify judouapp.com API responses."""
    url = flow.request.pretty_url
    if "judouapp.com" not in url:
        return

    content_type = flow.response.headers.get("Content-Type", "")
    if "json" not in content_type:
        return

    try:
        text = flow.response.get_text()
        if not text:
            return
        data = json.loads(text)
    except Exception:
        return

    modified = False

    # === users/wechat - 用户信息（含会员状态）===
    if "/api/v2/users/wechat" in url and isinstance(data, dict):
        changes = []
        for k, v in [("is_member", True), ("is_year_member", True),
                     ("can_access_featured_issues", True), ("is_splash_ad_free", True)]:
            if data.get(k) != v:
                data[k] = v
                changes.append(f"{k}:{v}")
        if data.get("member_type") is None:
            data["member_type"] = "lifetime"
            changes.append("member_type:lifetime")
        if data.get("role") == "normal":
            data["role"] = "member"
            changes.append("role:member")
        if data.get("member_expired_at") is not None:
            data["member_expired_at"] = None
            changes.append("member_expired_at:null")
        if changes:
            print(f"[MOD] users/wechat: {', '.join(changes)}")
            modified = True

    # === t/i - 功能开关（恢复购买）===
    elif "/api/v2/t/i" in url and isinstance(data, dict):
        if data.get("r") is False:
            data["r"] = True
            print("[MOD] t/i: r:True")
            modified = True

    # === global_config - 全局配置（主题/模板/广告）===
    elif "/api/v2/common/global_config" in url and isinstance(data, dict):
        changes = []
        if "templates" in data and isinstance(data["templates"], dict):
            changed_templates = {k: "free" for k, v in data["templates"].items()
                                 if v in ("unlock", "member")}
            if changed_templates:
                data["templates"].update(changed_templates)
                changes.append(f"templates {list(changed_templates.keys())}→free")

        for key in ["rbn", "hwrbn"]:
            if key in data and isinstance(data.get(key), (int, float)) and data[key] > 0:
                changes.append(f"{key}:{data[key]}→0")
                data[key] = 0
                modified = True

        if data.get("enable_issue_ad") is True:
            data["enable_issue_ad"] = False
            changes.append("enable_issue_ad:False")

        if changes:
            print(f"[MOD] global_config: {'; '.join(changes)}")
            modified = True

    # === products - 商品列表（改价格为免费）===
    elif "/api/v2/products" in url and isinstance(data, dict):
        if "data" in data and isinstance(data["data"], list):
            for prod in data["data"]:
                if isinstance(prod, dict):
                    if prod.get("cost_price", "0") != "0":
                        print(f"[MOD] products: {prod.get('name', '?')} cost→0")
                        prod["cost_price"] = "0"
                        prod["discount_price"] = "0"
                        prod["points_amount"] = 0
                        modified = True

    # === ads - 广告列表（清空）===
    elif "/api/v2/ads" in url and isinstance(data, list) and data:
        print(f"[MOD] ads: cleared {len(data)} ads")
        data.clear()
        modified = True

    if modified:
        new_text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        flow.response.set_text(new_text)
        flow.response.headers.pop("Content-Length", None)
        flow.response.headers.pop("etag", None)
        print(f"[MOD] ✓ {flow.request.path}")
