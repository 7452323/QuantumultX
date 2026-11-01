try {
  $persistentStore.write(
    't=' + (typeof $request) +
    ' k=' + (typeof $done) +
    ' url=' + ((typeof $request !== 'undefined' && $request && $request.url) || '-') +
    ' hdr=' + ((typeof $request !== 'undefined' && $request && $request.headers) ? Object.keys($request.headers).join('/') : 'NOHDR') +
    ' at=' + new Date().toISOString(),
    'probe_sxmd')
} catch (e) {
  $persistentStore.write('ERR ' + ((e && e.message) || e), 'probe_sxmd')
}
$done({})
