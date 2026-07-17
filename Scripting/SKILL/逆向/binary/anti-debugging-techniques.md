---
category: reverse-engineering
name: anti-debugging-techniques
description: Anti-debugging detection and bypass playbook for Linux and Windows native binaries. Covers ptrace, PEB flags, NtQueryInformationProcess, timing attacks, signal-based detection, TLS callbacks, VEH tricks.
---

# SKILL: Anti-Debugging Techniques — Detection & Bypass Playbook

## 1. LINUX ANTI-DEBUG

### ptrace(PTRACE_TRACEME)
```c
if (ptrace(PTRACE_TRACEME, 0, 0, 0) == -1) exit(1);
```
**Bypass**: LD_PRELOAD shim, binary patch, GDB catch syscall.

### /proc/self/status — TracerPid, /proc/self/maps
### Timing Checks (rdtsc / clock_gettime)
### Signal-Based Detection (SIGTRAP)

## 2. WINDOWS ANTI-DEBUG

### IsDebuggerPresent / CheckRemoteDebuggerPresent
### PEB Flags (BeingDebugged, NtGlobalFlag, Heap Flags)
### NtQueryInformationProcess (ProcessDebugPort 0x07, ProcessDebugObjectHandle 0x1E, ProcessDebugFlags 0x1F)
### Hardware Breakpoint Detection (DR0-DR3)
### INT 2D / INT 3 / UD2 Exception Tricks
### TLS Callbacks (execute before main)
### NtSetInformationThread(ThreadHideFromDebugger)

## 3. COUNTERMEASURE TOOLS

| Tool | Platform | Capability |
|---|---|---|
| ScyllaHide | Windows | Auto-patches PEB, hooks NtQuery*, hides threads |
| TitanHide | Windows | Kernel-level hiding |
| Frida | Cross-platform | Script-based hooking |
| Qiling | Cross-platform | Full-system emulation |

## 4. SYSTEMATIC BYPASS METHODOLOGY

```
Step 1: Static analysis — identify anti-debug calls
Step 2: Classify each check (API-based / Flag-based / Timing / Exception / Multi-process)
Step 3: Apply bypass (ScyllaHide → TLS callbacks → Frida patches → binary patches)
Step 4: Validate bypass completeness
```

## 5. Frida Anti-Debug Bypass (Cross-Platform)

```javascript
// Hook IsDebuggerPresent (Windows)
Interceptor.replace(Module.getExportByName('kernel32.dll', 'IsDebuggerPresent'),
  new NativeCallback(() => 0, 'int', []));

// Hook ptrace (Linux)
Interceptor.replace(Module.getExportByName(null, 'ptrace'),
  new NativeCallback(() => 0, 'long', ['int', 'int', 'pointer', 'pointer']));
```
