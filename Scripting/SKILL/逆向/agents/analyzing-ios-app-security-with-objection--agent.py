#!/usr/bin/env python3
"""iOS app security analysis agent using Objection/Frida concepts."""
import subprocess,json,sys
def run_objection(command,app_id=None,timeout=30):
    cmd = ["objection"]
    if app_id: cmd.extend(["-g",app_id])
    cmd.extend(["explore","-c",command])
    try:
        result = subprocess.run(cmd,capture_output=True,text=True,timeout=timeout)
        return result.stdout,result.returncode
    except FileNotFoundError: return "objection not installed",1
    except subprocess.TimeoutExpired: return "Command timed out",1
def run_frida(script_code,app_id,timeout=30):
    cmd = ["frida","-U","-n",app_id,"-e",script_code]
    try:
        result = subprocess.run(cmd,capture_output=True,text=True,timeout=timeout)
        return result.stdout,result.returncode
    except FileNotFoundError: return "frida not installed",1
    except subprocess.TimeoutExpired: return "Command timed out",1
def dump_keychain(app_id): return run_objection("ios keychain dump",app_id)
def dump_cookies(app_id): return run_objection("ios cookies get",app_id)
def list_classes(app_id,filter_str=None):
    cmd = "ios hooking list classes"
    if filter_str: cmd += f" --include {filter_str}"
    return run_objection(cmd,app_id)
def check_ssl_pinning(app_id): return run_objection("ios sslpinning disable",app_id)
def check_jailbreak_detection(app_id): return run_objection("ios jailbreak disable",app_id)
def inspect_filesystem(app_id,path="/"): return run_objection(f"ls {path}",app_id)
def dump_plist(app_id): return run_objection("ios plist cat Info.plist",app_id)
def check_pasteboard(app_id): return run_objection("ios pasteboard monitor",app_id)
def search_binary_strings(app_id,pattern): return run_objection(f"memory search '{pattern}'",app_id)
OWASP_MOBILE_CHECKS = {"M1_Improper_Platform_Usage":{"checks":["ios keychain dump","ios plist cat Info.plist"],"description":"Check for misuse of platform security"},"M2_Insecure_Data_Storage":{"checks":["ios keychain dump","ios cookies get","ios nsuserdefaults get"],"description":"Check for sensitive data in insecure storage"},"M3_Insecure_Communication":{"checks":["ios sslpinning disable"],"description":"Test SSL/TLS implementation"},"M4_Insecure_Authentication":{"checks":["ios hooking list classes --include Auth","ios hooking list classes --include Login"],"description":"Analyze authentication mechanisms"},"M5_Insufficient_Cryptography":{"checks":["ios hooking list classes --include Crypto","ios hooking list classes --include AES"],"description":"Review cryptographic implementations"},"M8_Code_Tampering":{"checks":["ios jailbreak disable"],"description":"Test runtime integrity"},"M9_Reverse_Engineering":{"checks":["ios hooking list classes"],"description":"Assess reverse engineering protections"}}
def run_owasp_assessment(app_id):
    results = {}
    for category,config in OWASP_MOBILE_CHECKS.items():
        category_results = {"description":config["description"],"findings":[]}
        for check in config["checks"]:
            output,rc = run_objection(check,app_id)
            category_results["findings"].append({"command":check,"status":"success" if rc==0 else "failed","output_preview":output[:200] if output else ""})
        results[category] = category_results
    return results
FRIDA_SCRIPTS = {"ssl_pinning_bypass":"ObjC.choose(ObjC.classes.NSURLSessionConfiguration,{onMatch:function(i){i['- setTLSMinimumSupportedProtocol:'](0)},onComplete:function(){}});","jailbreak_bypass":"var p=['/Applications/Cydia.app','/usr/sbin/sshd','/etc/apt'];Interceptor.attach(ObjC.classes.NSFileManager['- fileExistsAtPath:'].implementation,{onEnter:function(a){this.path=ObjC.Object(a[2]).toString()},onLeave:function(r){if(p.some(x=>this.path.includes(x)))r.replace(0)}});","keychain_dump":"var kSecClass=ObjC.classes.__NSDictionary.dictionaryWithObject_forKey_(ObjC.classes.__NSCFConstantString.alloc().initWithUTF8String_('genp'),ObjC.classes.__NSCFConstantString.alloc().initWithUTF8String_('class'));console.log('Keychain query prepared');"}
def generate_report(app_id,assessment_results):
    findings_count = sum(len(cat["findings"]) for cat in assessment_results.values())
    return {"app_identifier":app_id,"assessment_framework":"OWASP Mobile Top 10","categories_tested":len(assessment_results),"total_checks":findings_count,"results":assessment_results}
if __name__=="__main__":
    app_id = sys.argv[1] if len(sys.argv)>1 else None
    if not app_id:
        print("Usage: python agent.py <app_bundle_id>");sys.exit(0)
    results = run_owasp_assessment(app_id)
    report = generate_report(app_id,results)
    print(json.dumps(report,indent=2,default=str))
