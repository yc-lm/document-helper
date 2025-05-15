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

        <t-space direction="vertical" class="wrapper-body-video__buttons">
          <t-button block theme="primary" variant="base" @click="handleAudioAnalysis" :disabled="!audioBlobData"
            >开始语音识别</t-button
          >
        </t-space>
      </div>
      <div class="wrapper-body-detail">
        <t-tabs :value="tabActive" :theme="theme" @change="handlerChange">
          <t-tab-panel value="first">
            <template #label> <AudioIcon class="tabs-icon-margin" />语音转文字 </template>
            <audio-list :list="audioTextData"></audio-list>
          </t-tab-panel>
          <t-tab-panel value="second">
            <template #label> <FlagIcon class="tabs-icon-margin" /> 全文总结 </template>
            <p style="padding: 25px">
              {{ `${theme}选项卡2内容` }}
            </p>
          </t-tab-panel>
          <t-tab-panel value="third">
            <template #label> <ListIcon class="tabs-icon-margin" /> 段落 </template>
            <p style="padding: 25px">
              {{ `${theme}选项卡3内容` }}
            </p>
          </t-tab-panel>
          <t-tab-panel value="four">
            <template #label> <TreeRoundDotVerticalIcon class="tabs-icon-margin" /> 思维导图 </template>
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
import { AudioIcon, FlagIcon, ListIcon, TreeRoundDotVerticalIcon } from 'tdesign-icons-vue-next';
import wsHandler from './utils/wsHandler';
import { KeyValue } from './global';
import AudioList from "./components/AudioList.vue";

const PAGE_VARS = {
  // funASR服务连接地址
  funASRUrl: 'ws://127.0.0.1:10095/',
};

const percentage = ref(0); // 视频提取音频进度
const audioBlobData = ref(null); // 视频提取音频数据
const audioSrc = ref(''); // 视频提取音频地址
const videoSrc = ref(''); // 视频地址
const wsClient: KeyValue | null = ref(null); // ws连接
const totalSend = ref(0); // 音频采样数据
const audioTextData = ref<KeyValue[]>([]); // 语音识别结果

const tabActive = ref('first');
const theme = ref('normal');

const handlerChange = (newValue) => {
  tabActive.value = newValue;
};

const handleVideoInfo = (file) => {
  videoSrc.value = URL.createObjectURL(file.raw);
};

const handleAudioInfo = (blobData) => {
  audioBlobData.value = blobData;
  audioSrc.value = URL.createObjectURL(blobData);
};

const handleTranscodeProgress = (val: number) => {
  percentage.value = parseInt((val * 100).toFixed(2), 10);
};

const handleAudioAnalysis = async () => {
  await initWs();
};

// 开始转码消息
const startTranscriptionMessage = () => {
  return {
    chunk_size: new Array(5, 10, 5),
    wav_name: 'h5',
    wav_format: 'mp3',
    is_speaking: true,
    chunk_interval: 10,
    itn: false,
    mode: 'offline',
  };
};

const stopTranscriptionMessage = () => {
  const request = {
    chunk_size: new Array(5, 10, 5),
    wav_name: 'h5',
    is_speaking: false,
    chunk_interval: 10,
    mode: 'offline',
  };
  wsClient.value.send(JSON.stringify(request));
};

// 发送音频数据,切片后发送
const sendAudioData = async () => {
  if (!audioBlobData.value || !wsClient.value) return;

  // 将音频数据转换为 Uint8Array
  const arrayBuffer = await audioBlobData.value.arrayBuffer();
  const sampleBuf = new Uint8Array(arrayBuffer);
  const chunk_size = 960; // for asr chunk_size [5, 10, 5]
  let offset = 0;

  // 循环截取并发送数据
  while (offset < sampleBuf.length) {
    const end = Math.min(offset + chunk_size, sampleBuf.length);
    const sendBuf = sampleBuf.slice(offset, end);

    // 发送截取的数据
    wsClient.value.send(sendBuf);
    totalSend.value += sendBuf.length;
    offset = end;
  }

  // 发送停止转写消息
  stopTranscriptionMessage();
};
// 连接ws
const initWs = async () => {
  wsClient.value = wsHandler.connect(
    PAGE_VARS.funASRUrl,
    {
      connectionTimeout: 3000,
      maxRetries: 0,
    },
    {
      open: () => {
        console.log('ws:onOpen===>');
        wsClient.value.send(JSON.stringify(startTranscriptionMessage()));

        setTimeout(() => {
          sendAudioData();
        }, 2 * 1000);
      },
      error: (err) => {
        console.log('ws:onOpen===>', err);
      },
      message: (msg) => {
        console.log('on message,msg', msg);
        audioTextData.value = msg?.stamp_sents || [];
      },
      close: (err) => {
        console.log('ws:onclose===>', err);
      },
    },
  );
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

      &__buttons {
        width: 100%;
        margin-top: 50px;
      }
    }
    &-detail {
      flex-grow: 1;
      margin-left: 20px;
      max-height: 500px;
      overflow-y: auto;

      :deep(.t-tabs) {
        .tabs-icon-margin {
          margin-right: 8px;
        }
      }
    }
  }
}
</style>
