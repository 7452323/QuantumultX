---
name: detecting-api-enumeration-attacks
description: Detect and analyze API enumeration/scanning attacks through structured log analysis, request pattern identification, and behavioral anomaly detection.
domain: cybersecurity
subdomain: detection-engineering
tags: [API, enumeration, scanning, detection, log-analysis]
version: 1.0.0
author: mahipal
mitre_attack: [T1592, T1046, T1083, T1003.008, T1114.002]
---

# Detecting API Enumeration Attacks

## When to Use

- SOC analyst investigating alerts for unusual API request patterns
- Detecting automated API scanning/brute-forcing against web applications
- Building detection rules for API abuse and resource enumeration
- Threat hunting for reconnaissance activity targeting API endpoints
- Validating detection coverage for MITRE ATT&CK Discovery techniques

## Prerequisites

- Access to web server/API gateway logs (Nginx, Apache, Cloudflare, AWS ALB, etc.)
- Log analysis tools: Splunk, ELK Stack, or Python with pandas
- Baseline understanding of normal API traffic patterns for the target application
- Knowledge of common API frameworks and their default routes

## Workflow

### Step 1: Log Collection and Normalization

```sql
-- Splunk: Extract relevant fields from web server logs
index=web sourcetype=access_combined
| rex field=_raw "^(?<src_ip>\S+)\s+\S+\s+\S+\s+\[(?<timestamp>[^\]]+)\]\s+\"(?<method>\S+)\s+(?<uri>\S+)\s+\S+\"\s+(?<status>\d+)"
| table src_ip, timestamp, method, uri, status
```

### Step 2: Identify Enumeration Patterns

Indicators of API enumeration:

| Indicator | Description | Detection Method |
|-----------|-------------|-----------------|
| Sequential ID access | `/api/users/1`, `/api/users/2`, ... | Stddev of ID gaps < 2 |
| 404/403 flood | Many non-existent endpoint requests | Status ratio analysis |
| Parameter fuzzing | `?id=1 OR 1=1`, `?debug=true` | Regex pattern matching |
| High request velocity | >100 req/min from single IP | Rate-based threshold |
| Broad endpoint coverage | Requests to `/api/*` across many paths | Unique URI count per IP |

### Step 3: Calculate Enumeration Score

```python
import pandas as pd
from datetime import datetime, timedelta

def calculate_enumeration_score(df):
    """Calculate enumeration risk score for each source IP."""
    scores = {}
    for ip, group in df.groupby('src_ip'):
        score = 0
        # High request velocity (>100/min)
        if len(group) > 100:
            score += 30
        # Sequential ID access pattern
        ids = extract_numeric_ids(group['uri'])
        if len(ids) > 20 and std_gap(ids) < 2:
            score += 25
        # High 404 ratio (>40%)
        not_found_ratio = (group['status'] == 404).sum() / len(group)
        if not_found_ratio > 0.4:
            score += 25
        # Broad endpoint coverage
        unique_endpoints = len(group['uri'].unique())
        if unique_endpoints > 50:
            score += 20
        scores[ip] = score
    return scores
```

### Step 4: Triage and Response

```
Enumeration Score Triage Matrix:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score 0-20:  Low — Baseline noise or normal API client usage
Score 21-50: Medium — Investigate user-agent, referrer, geolocation
Score 51-75: High — Likely automated scanning, block IP temporarily
Score 76-100: Critical — Active attack, immediate IP block + escalate
```
