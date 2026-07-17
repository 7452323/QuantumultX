# JSVMP 源码级插桩专项指南（第四板斧）

> **v2.5.0 新增文档**。本指南讲解 camoufox-reverse MCP v0.4.0+ 提供的源码级插桩能力（`instrument_jsvmp_source` / `get_instrumentation_log` / `find_dispatch_loops`）的使用方法论，是 JSVMP 四板斧中"第四板斧"的完整说明。
>
> 与 `jsvmp-analysis.md` 的第一/二/三板斧互补——前三板斧诊断"VM 看外界 / 外界看 VM"，本文档讲解"VM 看自己"。