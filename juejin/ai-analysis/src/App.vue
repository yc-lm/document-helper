<template>
  <div class="wrapper">
    <div class="wrapper-header">
      <upload-file
        @video-info="handleVideoInfo"
        @audio-info="handleAudioInfo"
        @transcode-progress="handleTranscodeProgress"
      ></upload-file>
      <t-space class="wrapper-header-audio" direction="vertical">
        <div class="wrapper-header-audio__progress">
          <div class="wrapper-header-audio__progress--tip">提取音频进度：</div>
          <div class="wrapper-header-audio__progress--value">
            <t-progress theme="plump" :percentage="percentage" />
          </div>
        </div>

        <div class="wrapper-header-audio__player">
          <audio :src="audioSrc" controls autoplay />
        </div>
      </t-space>
    </div>

    <div class="wrapper-body">
      <div class="wrapper-body-video">
        <video :src="videoSrc" controls autoplay />
      </div>
      <div class="wrapper-body-detail">
        <t-tabs :value="tabActive" :theme="theme" @change="handlerChange">
          <t-tab-panel value="first">
            <template #label> <t-icon name="home" class="tabs-icon-margin" /> 语音转文字 </template>
            <p style="padding: 25px">
              {{ `${theme}选项卡1内容` }}
            </p>
          </t-tab-panel>
          <t-tab-panel value="second">
            <template #label> <t-icon name="calendar" class="tabs-icon-margin" /> 大纲 </template>
            <p style="padding: 25px">
              {{ `${theme}选项卡2内容` }}
            </p>
          </t-tab-panel>
          <t-tab-panel value="third">
            <template #label> <t-icon name="layers" class="tabs-icon-margin" /> 段落 </template>
            <p style="padding: 25px">
              {{ `${theme}选项卡3内容` }}
            </p>
          </t-tab-panel>
          <t-tab-panel value="four">
            <template #label> <t-icon name="layers" class="tabs-icon-margin" /> 思维导图 </template>
            <p style="padding: 25px">
              {{ `${theme}选项卡4内容` }}
            </p>
          </t-tab-panel>
        </t-tabs>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import UploadFile from './components/UploadFile.vue';

const translateAudioStatus = ref(0); // 视频提取音频状态 0:未开始 1:进行中 2:成功 3:失败
const percentage = ref(0); // 视频提取音频进度
const audioSrc = ref(''); // 视频提取音频地址
const videoSrc = ref(''); // 视频地址

const tabActive = ref('first');
const theme = ref('normal');

const handlerChange = (newValue) => {
  tabActive.value = newValue;
};

const handleVideoInfo = (file) => {
  videoSrc.value = URL.createObjectURL(file.raw);
};

const handleAudioInfo = (url) => {
  audioSrc.value = url;
};

const handleTranscodeProgress = (val: number) => {
  percentage.value = parseInt((val * 100).toFixed(2), 10);
};
</script>

<style lang="scss" scoped>
.wrapper {
  margin: 0 auto;
  &-header {
    display: flex;
    padding: 16px;
    &-audio {
      margin-left: 20px;
      flex-grow: 1;
      justify-content: space-between;
      &__progress {
        display: flex;
        align-items: center;
        &--value {
          flex-grow: 1;
        }
      }
      &__player {
        audio {
          width: 100%;
        }
      }
    }
  }

  &-body {
    display: flex;
    padding: 16px;
    border: 1px dashed #979ab0;

    &-video {
      width: 336px;
      video {
        width: 100%;
      }
    }
    &-detail {
      flex-grow: 1;
      margin-left: 20px;
    }
  }
}
</style>
