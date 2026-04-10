---
description: 清理所有调试日志代码
---

请按照以下流程清理调试日志：

1. 读取 `.claude/debug-state.json` 获取被修改的文件列表
2. 遍历这些文件，搜索 `__debugLog` 相关代码行
3. 删除所有包含 `__debugLog` 声明、赋值、输出的代码行
4. 删除 `.claude/debug-state.json`
5. 确认清理完成