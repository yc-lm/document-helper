/**
 * @name: recordEvent.ts
 * @author: yangcongcong
 * @date: @date: 2025/05/13
 * @description: 描述
 */

export const TranscodeEventCollection = {
  // 加载核心库成功
  LOAD_CORE_SUCCESS: 'LOAD_CORE_SUCCESS',

  // 转码结束触发的数据
  TRANSCODE_END_DATA: 'END_DATA',

  // 转码进度
  PROGRESS: 'PROGRESS',

  //  发生错误
  ERROR: 'ERROR',
};

// 错误类型
export const TranscodeErrorType = {
  LOAD_CORE_ERROR: 'LOAD_CORE_ERROR', // 加载核心库失败
  TRANSCODE_ERROR: 'TRANSCODE_ERROR', // 转码失败
};
