---
category: reverse-engineering
name: code-obfuscation-deobfuscation
description: Code obfuscation analysis and deobfuscation playbook. Covers junk code, opaque predicates, SMC, control flow flattening, movfuscator, VM protectors (VMProtect/Themida/Code Virtualizer), string encryption, import hiding, and anti-disassembly tricks.
---

# SKILL: Code Obfuscation & Deobfuscation — Expert Analysis Playbook

## 1. JUNK CODE & OPAQUE PREDICATES

### 1.1 Junk Code Insertion
Dead code that never affects program output, added to increase analysis time.

### 1.2 Opaque Predicates
Conditional branches where the condition is always true or always false.

| Type | Example | Always Evaluates To |
|---|---|---|
| Arithmetic | `x² ≥ 0` | True |
| Number theory | `x*(x+1) % 2 == 0` | True |

## 2. SELF-MODIFYING CODE (SMC)

Runtime code patching: encrypted code is decrypted just before execution.

## 3. CONTROL FLOW FLATTENING (CFF)

Original sequential blocks → dispatcher loop with switch(state). Recovery: D-810 IDA plugin or symbolic execution.

## 4. MOVFUSCATOR

All computation reduced to `mov` instructions only (Turing-complete). Created by Christopher Domas.

## 5. VM PROTECTION (VMProtect / Themida / Code Virtualizer)

Protected code → bytecode compiler → custom bytecode. Runtime: VM entry → fetch → decode → execute → VM exit.

## 6. STRING ENCRYPTION

| Pattern | Recovery |
|---|---|
| XOR loop | Hook or emulate XOR function |
| Stack strings | IDA FLIRT / Ghidra script to reassemble |
| RC4 encrypted | Extract key, decrypt offline |

## 7. IMPORT HIDING

GetProcAddress + Hash Lookup (CRC32, djb2, ROR13+ADD, FNV-1a)

## 8. ANTI-DISASSEMBLY TRICKS

Overlapping instructions, misaligned jumps, conditional jump pair, return address manipulation.

## 9. DECISION TREE

```
Obfuscated binary:
├─ Can you run it? → Dynamic analysis first
├─ Giant flat switch? → CFF → D-810 or symbolic deflattening
├─ Only mov instructions? → movfuscator → demovfuscator
├─ XOR/ADD loop writing to .text? → SMC → dump after decode
└─ Impossible conditions? → Opaque predicates → Z3 proving
```
