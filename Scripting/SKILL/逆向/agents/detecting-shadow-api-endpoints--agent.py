#!/usr/bin/env python3
"""Agent for discovering undocumented (shadow) API endpoints via traffic analysis."""
import argparse,json,re
from collections import defaultdict
from datetime import datetime,timezone
from urllib.parse import urlparse
def parse_access_log(log_path,api_prefix="/api"):
    endpoints=defaultdict(lambda:{"count":0,"methods":set(),"status_codes":set()})
    pattern=re.compile(r'(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+\S+"\s+(\d+)\s+(\d+)')
    try:
        with open(log_path,"r") as f:
            for line in f:
                m=pattern.match(line)
                if not m: continue
                method,path,status=m.group(3),m.group(4),m.group(5)
                clean_path=re.sub(r'/\d+','/{id}',urlparse(path).path)
                clean_path=re.sub(r'/[0-9a-f]{24,}','/{id}',clean_path)
                clean_path=re.sub(r'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}','/{uuid}',clean_path)
                if api_prefix and not clean_path.startswith(api_prefix): continue
                key=f"{method} {clean_path}";endpoints[key]["count"]+=1;endpoints[key]["methods"].add(method);endpoints[key]["status_codes"].add(status)
    except FileNotFoundError: print(f"[!] Log file not found: {log_path}")
    return endpoints
def load_openapi_spec(spec_path):
    documented=set()
    try:
        spec=json.load(open(spec_path,"r"))
        for path,methods in spec.get("paths",{}).items():
            normalized=re.sub(r'\{[^}]+\}','{id}',path)
            for method in methods:
                if method.upper() in ("GET","POST","PUT","DELETE","PATCH","HEAD","OPTIONS"): documented.add(f"{method.upper()} {normalized}")
    except: pass
    return documented
def find_shadow_endpoints(observed,documented):
    shadow=[]
    for endpoint,data in observed.items():
        if endpoint not in documented: shadow.append({"endpoint":endpoint,"call_count":data["count"],"status_codes":sorted(data["status_codes"]),"risk":"HIGH" if any(s.startswith("2") for s in data["status_codes"]) else "MEDIUM"})
    return sorted(shadow,key=lambda x:x["call_count"],reverse=True)
def classify_risk(shadow_endpoints):
    categories={"debug":[],"admin":[],"internal":[],"deprecated":[],"unknown":[]}
    for ep in shadow_endpoints:
        path=ep["endpoint"].lower()
        if any(k in path for k in["debug","test","dev","health"]): categories["debug"].append(ep)
        elif any(k in path for k in["admin","manage","console","dashboard"]): categories["admin"].append(ep)
        elif any(k in path for k in["internal","private","system"]): categories["internal"].append(ep)
        elif any(k in path for k in["v1","v0","old","legacy"]): categories["deprecated"].append(ep)
        else: categories["unknown"].append(ep)
    return categories
def main():
    parser=argparse.ArgumentParser(description="Discover undocumented shadow API endpoints")
    parser.add_argument("--access-log",required=True,help="Path to web access log");parser.add_argument("--openapi-spec",help="OpenAPI spec");parser.add_argument("--api-prefix",default="/api",help="API prefix");parser.add_argument("--output","-o",help="Output path");parser.add_argument("--min-calls",type=int,default=1,help="Min call count")
    args=parser.parse_args()
    observed=parse_access_log(args.access_log,args.api_prefix)
    documented=load_openapi_spec(args.openapi_spec) if args.openapi_spec else set()
    shadow=find_shadow_endpoints(observed,documented)
    shadow=[s for s in shadow if s["call_count"]>=args.min_calls]
    report={"timestamp":datetime.now(timezone.utc).isoformat(),"total_observed":len(observed),"shadow_count":len(shadow),"categories":{k:len(v) for k,v in classify_risk(shadow).items()},"shadow_endpoints":shadow[:50]}
    if args.output: json.dump(report,open(args.output,"w"),indent=2)
    else: print(json.dumps(report,indent=2))
if __name__=="__main__": main()
