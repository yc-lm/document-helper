---
description: 根据问题描述，自动分析代码并在关键路径添加调试日志
---

请按照以下流程添加调试日志：

1. **分析问题**：根据问题描述，搜索/阅读相关代码
2. **定位路径**：识别数据流、事件链、函数调用等关键路径
3. **插入日志**：使用 `__debugLog` 格式在关键位置收集信息
4. **输出日志**：在流程末尾添加 `console.log('DEBUG_LOG', JSON.stringify(__debugLog))`
5. **记录状态**：将修改的文件路径记录到 `.claude/debug-state.json`
6. **等待反馈**：告知用户操作步骤，等待复制 `DEBUG_LOG` 输出
7. **定位根因**：根据日志分析，提出修复方案

## 日志格式

```js
const __debugLog = {};
__debugLog.init = 'ok';
__debugLog.dataLen = data?.length ?? 0;
// ...
console.log('DEBUG_LOG', JSON.stringify(__debugLog));
```

## 原则

- **极简**：缩写 key + 短 value，控制在 2000 字符内
- **集中输出**：最终只输出 `DEBUG_LOG` 一条日志
- **5-8 条上限**：只在关键路径打点
- **可识别**：所有调试代码包含 `__debugLog` 标记