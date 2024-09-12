<template>
  <t-upload
    ref="uploadRef"
    :key="uuidKey"
    v-model="fileList"
    class="oss-upload"
    :class="{ ['not-init']: !isInit }"
    :multiple="multiple"
    :disabled="disabled"
    :auto-upload="autoUpload"
    :draggable="isDraggable"
    :upload-all-files-in-one-request="uploadInOneRequest"
    :is-batch-upload="isBatchUpload"
    :trigger-button-props="buttonProps"
    :before-upload="beforeUpload"
    placeholder=""
    tips=""
    :action="actionUrl"
    :style="styleObj"
    :request-method="requestMethod"
    :accept="fileTypeObj.mimeType"
    @fail="handleError"
    @success="handleSuccess"
    @drop="handleDrop"
  >
    <template #file-list-display>
      <div v-show="isProgress || isSuccess || isError" class="custom-wrap">
        <div class="file-info">
          <!--名称-->
          <div class="custom-info">
            <div class="custom-info--filename">
              {{ currentFileObj.name }}
            </div>
            <div v-if="isProgress" class="custom-info--progress">
              <loading />
              <span class="m-l-8">{{ `${uploadPercentage}%` }}</span>
            </div>

            <div v-if="isSuccess" class="custom-info--success">
              <check-circle-filled-icon />
            </div>
            <div v-if="isError" class="custom-info--error">
              <error-circle-filled-icon />
            </div>
          </div>

          <!--文件大小-->
          <div class="custom-size">
            <span>文件大小：</span>
            <span>{{ formatBytes(currentFileObj.size) }}</span>
          </div>
        </div>

        <!--按钮-->
        <div class="custom-buttons">
          <t-link
            v-show="isMultiPart && isProgress"
            theme="primary"
            hover="color"
            :disabled="isDisabledCancelBtn"
            @click="handleCancelUpload"
          >
            取消上传
          </t-link>

          <t-link v-show="isSuccess || isError" theme="primary" hover="color" class="m-r-16" @click="handleReUpload">
            重新上传
          </t-link>

          <t-link v-show="isSuccess || isError" theme="danger" hover="color" @click="handleDelete"> 删除</t-link>
        </div>
      </div>
    </template>
  </t-upload>
</template>

<script setup lang="ts">
import cloneDeep from 'lodash/cloneDeep';
import isNumber from 'lodash/isNumber';
import { CheckCircleFilledIcon, ErrorCircleFilledIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { v4 as uuidv4 } from 'uuid';
import { computed, onMounted, reactive, ref, toRefs, watch } from 'vue';

import loading from '@/assets/loading.svg';
import { UnknowValue } from '@/components/dx-table/type';
import { calculateIsMultipart, getFileTypeDefine, useUpload } from '@/hooks/useUpload';
import { getPermissionStore, useUserStore } from '@/store';
import DebugLog from '@/utils/log/debugLog.ts';
import { formatBytes, sleep } from '@/utils/object';
import { MULTI_UPLOAD_EVENT } from '@/utils/upload/multipart.ts';
import S3Upload from '@/utils/upload/S3Upload';

const props = defineProps({
  uploadInOneRequest: {
    default: false,
    type: Boolean,
  },
  multiple: {
    default: false,
    type: Boolean,
  },
  disabled: {
    default: false,
    type: Boolean,
  },
  autoUpload: {
    default: true,
    type: Boolean,
  },
  isBatchUpload: {
    default: false,
    type: Boolean,
  },
  marginVal: {
    default: 0,
    type: [Number, String],
  },
  buttonProps: {
    default: () => {
      return { theme: 'default', variant: 'outline' };
    },
    type: Object,
  },
  actionUrl: {
    default: '',
    type: String,
  },
  fileType: {
    default: '',
    type: String,
  },
  currentId: {
    default: '',
    type: String,
  },
  isDelete: {
    default: true,
    type: Boolean,
  },

  // 初始化client方式：1：onMounted调用 2：watch token变化
  initClientType: {
    default: 1,
    type: Number,
  },
  // 是否可拖拽
  isDraggable: {
    default: true,
    type: Boolean,
  },
});

const {
  uploadInOneRequest,
  multiple,
  disabled,
  autoUpload,
  isBatchUpload,
  marginVal,
  buttonProps,
  actionUrl,
  fileType,
  currentId,
  initClientType,
} = toRefs(props);

const uploadRef = ref(null);
const uploadInstance: UnknowValue = ref(null);
const fileList = ref([]);
const logPrefix = 'oss-upload';
// 是否需要分片上传
const isMultiPart = ref(false);
// 分片上传返回的信息
const multiUploadInfo = reactive({
  uploadId: '',
  progress: 0,
  key: '',
});
// 上传结果
const uploadResult = ref({});
// 普通上传模拟进度定时器
const mockInterval: UnknowValue = ref(null);
// 当前上传文件对象
const currentFileObj = ref({});
// 记录重试的上下文
const retryContext = reactive({
  count: 0, // 重试的次数
  isHand: false, // 是否手动取消
  delayTime: 5 * 1000, // 失败后延迟多久重试
});
// 最大重试次数
const RetryMaxNumber = 3;
// 唯一key
const uuidKey = ref('');
// 日志
const debugObj: UnknowValue = ref(null);
// 拖拽结束后的timeout
const dropTimeout = ref();
const {
  UPLOAD_VARS,
  uploadStatus,
  updatePercentage,
  updateStatus,
  isProgress,
  isSuccess,
  isError,
  isInit,
  uploadPercentage,
} = useUpload();
const store = getPermissionStore();
const userStore = useUserStore();

// 触发的事件
const emits = defineEmits(['uploadSuccess', 'uploadError', 'uploadProgress']);

// stsToken
const currentToken = computed(() => {
  return store.ossTokenInfo.securityToken;
});

// 按钮样式
const styleObj = computed(() => {
  return {
    margin: isNumber(marginVal.value) ? `${marginVal.value}px` : marginVal.value,
  };
});

// 文件类型定义
const fileTypeObj = computed(() => {
  return getFileTypeDefine(fileType.value) as UnknowValue;
});

// 是否能点击取消上传
const isDisabledCancelBtn = computed(() => {
  return !multiUploadInfo?.uploadId;
});

const beforeUpload = async (file) => {
  console.log(`${logPrefix}:beforeUpload===>`, file);
  // 清除drag结束的定时器
  if (dropTimeout.value) {
    clearTimeout(dropTimeout.value);
    dropTimeout.value = null;
  }
  // 是否已经有上传实例
  if (!uploadInstance.value) {
    await initMethod();
  }

  // 添加文件类型或大小的校验
  const allowedTypes = fileTypeObj.value.mimeType.split(',');
  // 类型
  if (!allowedTypes.includes(file.type)) {
    await MessagePlugin.warning(`不支持的文件类型: ${file.type}`);
    return false; // 阻止文件上传
  }

  // 大小
  if (file.size > fileTypeObj.value.limit) {
    await MessagePlugin.warning(`上传的文件不能大于${fileTypeObj.value.limitTip}`);
    return false;
  }

  // 记录文件信息
  currentFileObj.value = file;
  return true;
};
// 拖拽结束
const handleDrop = (params) => {
  console.log('handleDrop,', params, cloneDeep(fileList.value));
  dropTimeout.value = setTimeout(() => {
    MessagePlugin.warning(`请检查上传文件的格式是否正确`);
  }, 500);
};

// 普通上传模拟进度
const mockProcess = () => {
  stopTick();
  // 控制上传进度
  let percent = 0;
  mockInterval.value = setInterval(() => {
    if (percent + 10 < 99) {
      percent += 10;
      updatePercentage(percent);
    } else {
      stopTick();
    }
  }, 100);
};

const stopTick = () => {
  if (mockInterval.value) {
    clearInterval(mockInterval.value);
    mockInterval.value = null;
  }
};

const requestMethod = async (file) => {
  console.log(`${logPrefix}:requestMethod===>`, file);

  // 是否需要分片
  isMultiPart.value = calculateIsMultipart(file.size);
  // 更新状态
  updateStatusHook(UPLOAD_VARS.progress, 'uploadProgress');

  // 开始上传
  await startUploadMethod(file);

  // 失败并且重试次数小于3
  if (isUploadResultError(uploadResult.value) && retryContext.count < RetryMaxNumber) {
    // 如果是手动,直接返回失败
    if (retryContext.isHand) {
      retryContext.isHand = false;
      return uploadResult.value;
    }

    // 循环
    while (retryContext.count < RetryMaxNumber) {
      // 写入日志
      debugObj.value.log({
        status: uploadResult.value?.status,
        filename: file.name,
        retryCount: retryContext.count,
        originalError: uploadResult.value?.originalError,
        isMultiPart: isMultiPart.value,
      });

      // 开始上传
      await startUploadMethod(file);

      // 如果成功，跳出循环
      if (isUploadResultOk(uploadResult.value)) {
        break;
      }

      // 如果失败，延迟执行
      if (isUploadResultError(uploadResult.value)) {
        await sleep(retryContext.delayTime);
      }

      // 更新次数
      retryContext.count += 1;
    }
    // 清空重试上下文
    clearRetryContext();
    return uploadResult.value;
  }

  return uploadResult.value;
};

// 是否成功
const isUploadResultOk = (data) => {
  return data?.status === 'success';
};
// 是否失败
const isUploadResultError = (data) => {
  return data?.status === 'fail';
};

const startUploadMethod = async (file) => {
  // 是否为重试
  const isRetry = retryContext.count > 0;

  if (isMultiPart.value) {
    // 为断点续传
    if (isRetry) {
      uploadResult.value = await uploadInstance.value.breakPointResume(file, {
        breakUploadId: multiUploadInfo.uploadId,
        breakKey: multiUploadInfo.key,
      });
    } else {
      uploadResult.value = await uploadInstance.value.multipartUpload(file);
    }
  } else {
    // 开始模拟进度,
    // 如果是重试，不模拟，防止进度从0开始
    if (!isRetry) {
      mockProcess();
    }

    uploadResult.value = await uploadInstance.value.uploadFile(file);
  }
};

const handleError = (params) => {
  // 处理上传失败的逻辑
  console.log(`${logPrefix}:handleError===>`, params);
  // 停止模拟进度
  stopTick();
  // 更新状态
  updateStatusHook(UPLOAD_VARS.error, 'uploadError');
};
const handleSuccess = (params) => {
  // 处理上传成功的逻辑
  console.log(`${logPrefix}:handleSuccess===>`, params);
  currentFileObj.value = params?.file;
  // 如果是普通上传
  if (!isMultiPart.value) {
    // 停止模拟进度
    stopTick();
    // 更新进度为100
    updatePercentage(100);
  }
  // 更新状态
  updateStatusHook(UPLOAD_VARS.success, 'uploadSuccess');
};

// 点击取消上传
const handleCancelUpload = () => {
  console.log(`${logPrefix}:handleClickCancel===>`, multiUploadInfo.uploadId, multiUploadInfo.key);
  uploadInstance.value?.abortMultipartUpload(multiUploadInfo?.uploadId, multiUploadInfo?.key);
  // 手动取消,无需重试
  retryContext.isHand = true;
};

// 获取oss配置
const getOssConfig = async () => {
  const { region, bucket, endpoint } = userStore.ossInfo;
  // 增加冗余判断，防止异常情况第一次未获取到
  if (!region || !bucket || !endpoint) {
    await userStore.getServiceConfig();
  }
  return userStore.ossInfo;
};

// 初始化
const initMethod = async () => {
  const ossConfig = await getOssConfig();
  uploadInstance.value = new S3Upload(ossConfig);
  const ossClient = await uploadInstance.value.getInstance();

  // 注册分片上传事件
  registerMultiUploadEvent();
  console.log(`${logPrefix}:initMethod===>`, ossClient);
};

// 监听分片上传信息
const registerMultiUploadEvent = () => {
  uploadInstance.value.on(MULTI_UPLOAD_EVENT.UPLOAD_ID, ({ uploadId, fileName }) => {
    multiUploadInfo.uploadId = uploadId;
    multiUploadInfo.key = fileName;
  });

  uploadInstance.value.on(MULTI_UPLOAD_EVENT.UPLOAD_PROGRESS, (p) => {
    updatePercentage(p * 100);
  });
};

// 主动获取上传信息
const getUploadInfo = () => {
  return {
    id: currentId.value,
    url: uploadResult.value?.response?.url,
    uploadStatus: uploadStatus.value,
    name: currentFileObj.value?.name,
  };
};

// 更新状态，触发时间
const updateStatusHook = (status, eventName = '', isEvent = true) => {
  // 更新状态
  updateStatus(status);
  // 触发事件
  if (isEvent && eventName) {
    emits(eventName, getUploadInfo());
  }
};

// 删除
const handleDelete = () => {
  // uploadRef.value.reset();
  console.log(uploadRef.value);
  getUuid();
  resetStatus();
};
// 重新上传
const handleReUpload = () => {
  getUuid();
  resetStatus();
  uploadRef.value.triggerUpload();
};

const clearRetryContext = () => {
  retryContext.count = 0;
  retryContext.isHand = false;
};

// 重置状态
const resetStatus = () => {
  // 重置状态
  updateStatusHook(UPLOAD_VARS.init);
  // 重置进度
  updatePercentage(0);
  // 重置变量
  fileList.value = [];
  isMultiPart.value = false;
  uploadResult.value = {};
  currentFileObj.value = {};
  multiUploadInfo.uploadId = '';
  multiUploadInfo.progress = 0;
  multiUploadInfo.key = '';
  // 清空重试上下文
  clearRetryContext();
};

// 获取uuid
const getUuid = () => {
  uuidKey.value = uuidv4();
};

watch(
  () => currentToken.value,
  () => {
    if (initClientType.value === 2) {
      initMethod();
    }
  },
);

onMounted(() => {
  debugObj.value = new DebugLog({ prefix: logPrefix });
  getUuid();
  if (initClientType.value === 1) {
    initMethod();
  }
});

defineExpose({
  getUploadInfo,
});
</script>
<style lang="scss">
.oss-upload {
  &.t-upload {
    .t-upload__tips-error {
      //display: none;
    }

    .t-upload__dragger {
      width: 100%;
      height: 124px;
      border-radius: var(--td-radius-extraLarge);
      background: var(--td-gray-white);

      .t-upload__trigger {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;

        .t-upload--highlight {
          color: var(--td-brand-color);
        }
      }

      .t-upload__dragger-progress {
        .t-upload__dragger-progress-info {
          .t-upload__dragger-btns {
            display: none;
          }
        }
      }
    }
  }
}
</style>
<style lang="scss" scoped>
.custom-wrap {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;

  .file-info {
    .custom-info {
      display: flex;
      align-items: center;
      font: var(--td-font-body-medium);

      &--filename {
        color: var(--td-font-gray-1);
        margin-right: var(--td-comp-margin-s);
      }

      &--progress {
        display: flex;
        align-items: center;
        color: var(--td-brand-color-6);
      }

      &--success {
        color: var(--td-success-color);
      }

      &--error {
        color: var(--td-error-color);
      }
    }

    .custom-size {
      font: var(--td-font-body-small);
      color: var(--td-font-gray-3);
      margin-top: var(--td-comp-margin-s);
    }
  }

  .custom-buttons {
  }
}
</style>
