<!--
@name: UploadFile.vue
@author: yangcongcong
@date: 2025/5/13
@description: 描述
-->
<template>
  <div>
    <t-upload
      ref="uploadRef"
      v-model="fileList"
      :multiple="false"
      :auto-upload="true"
      :is-batch-upload="false"
      :before-upload="beforeUpload"
      :request-method="requestMethod"
      action=""
      @fail="handleError"
      @success="handleSuccess"
    />
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import TranscodeManage from '../utils/ffmpeg/TranscodeManage';
import { TranscodeEventCollection } from '../utils/ffmpeg/ffmpegEvent';
import { KeyValue } from '../global';

defineOptions({ name: 'UploadFile' });

const fileList = ref([]);
const uploadRef: KeyValue = ref(null);
const transcodeInstance: KeyValue = ref(null);

// 手动上传
const requestMethod = async (file) => {
  console.log(`requestMethod===>`, file);
  await transcodeInstance.value.transcodeMp3(file.raw, 'm4a');
  return {
    status: 'success',
    response: { url: '' },
  };
};

const beforeUpload = (file) => {
  console.log(`beforeUpload===>`, file);
  return true;
};

// 处理上传失败的逻辑
const handleError = (params) => {
  console.log(`handleError===>`, params);
};
// 处理上传成功的逻辑
const handleSuccess = (params) => {
  console.log(`handleSuccess===>`, params);
};

// 初始化转码
const initTranscode = async () => {
  transcodeInstance.value = new TranscodeManage();
  console.log(`initTranscode===>`, transcodeInstance.value);
  registerTranscodeEvent();

  await transcodeInstance.value.load();
};

// 注册转码事件
const registerTranscodeEvent = () => {
  transcodeInstance.value.on(TranscodeEventCollection.LOAD_CORE_SUCCESS, () => {
    console.log(`registerTranscodeEvent===> LOAD_CORE_SUCCESS`);
  });

  transcodeInstance.value.on(TranscodeEventCollection.TRANSCODE_END_DATA, (blobData) => {
    console.log(`registerTranscodeEvent===> TRANSCODE_END_DATA`, blobData);

    const url = URL.createObjectURL(blobData);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.mp3';
    a.click();

    URL.revokeObjectURL(url);
  });
};

onMounted(() => {
  initTranscode();
});
</script>
<style scoped lang="scss"></style>
