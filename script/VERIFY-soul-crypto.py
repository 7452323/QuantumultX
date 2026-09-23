"""验证 zu.l.a / zu.c.a / zu.m.a 复刻的正确性

slb = urlB64( stdB64( DES/ECB/PKCS5(明文, key) ) )
交叉验证: 标准 DES/ECB/PKCS5 + 真实抓包 slb
"""
import base64, subprocess
from Crypto.Cipher import DES

# zu/c.java: Cipher.getInstance("DES") => DES/ECB/PKCS5Padding，标准 base64 表
def des_encrypt(plain: bytes, key: bytes) -> bytes:
    return DES.new(key[:8], DES.MODE_ECB).encrypt(
        plain + bytes([8 - len(plain) % 8]) * (8 - len(plain) % 8))

def des_decrypt(ct: bytes, key: bytes) -> bytes:
    pt = DES.new(key[:8], DES.MODE_ECB).decrypt(ct)
    if not pt: return pt
    n = pt[-1]
    return pt[:-n] if 1 <= n <= 8 and pt[-n:] == bytes([n]) * n else pt

std_b64 = lambda b: base64.b64encode(b).decode()
url_b64 = lambda s: base64.b64encode(s.encode('latin1')).decode()

print('=' * 62)
print('[1] 标准 DES/ECB/PKCS5 自检 (与 openssl 比对)')
key, plain = b'NvAb7tUJ', b'0123456789abcdef'
ct = des_encrypt(plain, key)
print('    py-实现(hex):', ct.hex())
r = subprocess.run(['openssl', 'enc', '-des-ecb', '-K', key.hex(), '-nosalt', '-provider', 'legacy', '-provider', 'default'],
                   input=plain, capture_output=True)
print('    openssl(hex):', r.stdout.hex() if r.returncode == 0 else f'(openssl 失败: {r.stderr.decode()[:60]})')
print('    一致:', ct.hex() == r.stdout.hex())
print('    自解密往返:', des_decrypt(ct, key) == plain)

print()
print('=' * 62)
print('[2] 真实抓包 slb 结构验证')
real = 'dE1vSGF4bzBvYWVyQkZZSzEvanZ0N3NoZmxPWEY4U1p0TW9IYXhvMG9hZUNPOXFJaWM2TEJRPT0='
l1 = base64.b64decode(real).decode('latin1')
l2 = base64.b64decode(l1)
print('    第1层:', l1)
print('    第2层:', len(l2), '字节 =', len(l2) // 8, '个 DES 块')
blk = [l2[i:i+8].hex() for i in range(0, len(l2), 8)]
for i, b in enumerate(blk):
    tag = '  <-- 与块0相同' if i == 3 else ''
    print(f'      块{i}: {b}{tag}')
print('    块0 == 块3 :', blk[0] == blk[3], '(ECB 模式下明文重复块的必然结果 => 模式确认为 ECB)')

print()
print('=' * 62)
print('[3] 编码链往返 (复刻的编码器)')
enc = url_b64(std_b64(des_encrypt(plain, key)))
back = des_decrypt(base64.b64decode(base64.b64decode(enc).decode('latin1')), key)
print('    明文 -> DES -> stdB64 -> urlB64 =', enc)
print('    反向解码 =', back, '| 一致:', back == plain)

print()
print('=' * 62)
print('[4] 候选密钥尝试解真实 slb (可读率 >= 90% 则胜出)')
cands = [b'NvAb7tUJYol6UNoBa5Jt', b'}%2R+\\OSsjpP!w%X', b'}r.GCD:nGF5.FX_t',
         b'6vYDbZ-xPWCuzyiVT-nqx_DoqBkDgfq2h', b'pVGXGRh1wXiGQ4XF2I1p4bsXrLI4o7yl',
         b'789!@#xswEDCzxcv', b'x9JkXpR@fi', b'kG@yGB9', b'SoulPowerful']
hit = False
for cd in cands:
    for k in (cd[:8], cd[-8:]):
        try:
            pt = DES.new(k, DES.MODE_ECB).decrypt(l2)
        except Exception:
            continue
        ratio = sum(32 <= c < 127 for c in pt) / len(pt)
        if ratio >= 0.9:
            hit = True
            print(f'    ★ {k!r} 可读率 {ratio*100:.0f}%: {pt!r}')
print('    (无 ★ = 全部候选不成立；密钥为 hex(MD5(APK签名派生))，见 SOUL-CS-ALGORITHM.md 第五节)')
