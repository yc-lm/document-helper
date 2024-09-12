/**
 * @name: multipart.ts
 * @author: yangcongcong
 * @date: 2024/8/23
 * @description: 描述
 */
import { getStsToken } from '@/api/file';
import { getPermissionStore } from '@/store';

// 分片上传时触发的事件
export const MULTI_UPLOAD_EVENT = {
  UPLOAD_ID: 'UPLOAD_ID', // 上传id事件
  UPLOAD_PROGRESS: 'UPLOAD_PROGRESS', // 进度事件
};

// 辅助函数：计算分片总数
export function calculateTotalChunks(file, chunkSize) {
  return Math.ceil(file.size / chunkSize);
}

// 辅助函数：创建分片
export function sliceFile(file, start, end) {
  const chunk = file.slice(start, end);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(chunk);
  });
}

// 获取token
export const getStsTokenCache = async (force = false) => {
  // 先从store中获取
  const store = getPermissionStore();
  let { securityToken, accessKeyId, accessKeySecret } = store.ossTokenInfo;

  // 不存在 or 强制刷新 时重新获取
  if (force || !securityToken || !accessKeyId || !accessKeySecret) {
    const { data } = await getStsToken(); // 调用后端API获取STS Token
    if (data.accessKeyId && data.accessKeySecret) {
      store.setOssToken(data);
      securityToken = data.securityToken;
      accessKeyId = data.accessKeyId;
      accessKeySecret = data.accessKeySecret;
    }
  }
  console.log('getOSSClient', securityToken, accessKeyId, accessKeySecret);
  return {
    securityToken,
    accessKeyId,
    accessKeySecret,
  };
};
