// 文件大于多少时使用分片上传
export const USE_PART_UPLOAD_LIMIT = 100 * 1024 * 1024; // 100M
// 分片上传，分片大小
export const CHUNK_PART_SIZE = 50 * 1024 * 1024; // 50M
// 分片并发上传数量
export const PARALLEL_NUMBER = 2;
// 过期时间，s3签名最大不能超过1周
export const EXPIRE_TIME = 3600 * 24 * 6;

export const UPLOAD_FILE_TYPE = {
  // 文档类
  EXCEL: 'EXCEL',
  // 音频以及视频
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
};

export const UPLOAD_FILE_LIST = [
  {
    type: UPLOAD_FILE_TYPE.EXCEL,
    limit: 100 * 1024 * 1024,
    limitTip: '100M',
    mimeType:
      '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf',
  },
  {
    type: UPLOAD_FILE_TYPE.VIDEO,
    limit: 6 * 1024 * 1024 * 1024,
    limitTip: '6G',
    mimeType: 'video/mp4',
  },
  {
    type: UPLOAD_FILE_TYPE.AUDIO,
    limit: 6 * 1024 * 1024 * 1024,
    limitTip: '6G',
    mimeType: 'audio/mpeg,audio/aac,audio/wav',
  },
];
