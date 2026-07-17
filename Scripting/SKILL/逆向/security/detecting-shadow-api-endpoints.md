---
name: detecting-shadow-api-endpoints
description: Discover undocumented, deprecated, or hidden API endpoints by analyzing client-side code, reverse engineering mobile applications, and probing for exposed internal services.
domain: cybersecurity
subdomain: application-security
tags: [API, shadow-api, mobile-security, reverse-engineering, discovery]
version: 1.0.0
author: mahipal
mitre_attack: [T1557, T1557.001, T1040, T1071.001, T1565.001]
---

# Detecting Shadow API Endpoints

## When to Use

- Security assessment of web/mobile applications to discover undocumented APIs
- Red team operations identifying backend endpoints not in public documentation
- Bug bounty hunting for hidden/vulnerable API endpoints
- Verifying that deprecated API versions are properly decommissioned
- Internal security audits to ensure no rogue APIs exist in production

## Prerequisites

- APK decompilation tools: jadx, apktool (for Android apps)
- JavaScript analysis: Chrome DevTools, browser extension source viewers
- HTTP proxy: Burp Suite, mitmproxy for traffic interception
- Wordlist for endpoint fuzzing (SecLists, custom)
- Access to mobile application binaries (APK/IPA) or web application source maps

## Workflow

### Step 1: Extract Endpoints from Web Applications

```bash
# Download JavaScript files and extract API endpoints
curl -s https://target.com/main.js | grep -oP '"(\/[a-zA-Z0-9_\/]+)"' | sort -u

# Extract from source maps
curl -s https://target.com/main.js.map | python3 -m json.tool | grep -oP '"[^"]+api[^"]+"'

# Search for hardcoded endpoints
grep -r "baseURL\|apiUrl\|API_URL\|endpoint" ./js_files/
```

### Step 2: Extract Endpoints from Mobile Applications

```bash
# Android: Decompile APK and search for endpoints
jadx -d decompiled/ target.apk
grep -r "https\?://" decompiled/ | grep -v "android.com\|google.com"
grep -r "baseUrl\|BASE_URL\|api_endpoint" decompiled/

# iOS: Extract strings from IPA
unzip target.ipa
strings Payload/Target.app/Target | grep -E 'https?://[a-zA-Z0-9.-]+'
```

### Step 3: Identify Internal/Admin Endpoints

```bash
# Common shadow API path patterns to probe
/admin/api/users
/api/v2/users (deprecated version)
/api/internal/health
/api/debug/config
/staging/api/
/backup/api/
```

### Step 4: Automated Discovery Script

```python
#!/usr/bin/env python3
"""Discover shadow API endpoints via pattern-based probing."""
import requests

SHADOW_PATTERNS = [
    '/api/v{}/users', '/api/internal/', '/api/admin/',
    '/api/debug/', '/api/staging/', '/graphql',
    '/.env', '/api-docs', '/swagger.json',
]

def probe_endpoints(base_url, patterns):
    discovered = []
    for pattern in patterns:
        for version in [1, 2, 3]:
            url = base_url + pattern.format(version)
            try:
                r = requests.get(url, timeout=5, allow_redirects=False)
                if r.status_code != 404:
                    discovered.append({
                        'url': url,
                        'status': r.status_code,
                        'content_type': r.headers.get('Content-Type', '')
                    })
            except: pass
    return discovered
```
