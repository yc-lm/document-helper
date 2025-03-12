<!--
 * @name: ReactiveVideo.vue
 * @author: yangcongcong
 * @date: 2025/2/26
 * @description: 视频播放组件
-->

<template>
  <view class="reactive-video relative" :style="styleObj" :class="{ 'is-tap': isTap }">
    <video
        :id="`sVideo${uid}`"
        class="w-100p h-100p"
        :show-center-play-btn="false"
        :src="playUrl"
        :controls="isControls"
        :autoplay="autoplay"
        v-bind="$attrs"
        @error="videoErrorCallback"
        @play="handlePlay"
        @pause="handlePause"
        @ended="handleEnded"
        @timeupdate="handleUpdateTime"
        @loadeddata="loadeddata"
        @loadedmetadata="loadedmetadata"
        @controlstoggle="handleControlsToggle"
        @fullscreenchange="handleFullScreenChange"
    >
      <!--显示返回按钮-->
      <cover-image
          class="back-img"
          src="/static/images/icon-arrow-left.png"
          @tap="handleBack"
      ></cover-image>
      <!--显示播放按钮-->
      <!-- #ifdef APP-PLUS -->
      <cover-image
          v-if="isInitPlayImg"
          class="init-play-img"
          src="/static/images/video/init-play.png"
          @tap="handleInitPlay"
      ></cover-image>
      <!-- #endif -->
      <!--触发自定义按钮显示隐藏-->
      <cover-view class="overlay" v-if="isShowOverlay" @click="handleTap"></cover-view>
    </video>

    <!-- #ifdef H5 -->
    <view
        v-show="isShowCustomControls"
        class="reactive-video__h5cover"
        @tap.stop.prevent="handleCustomTap"
    >
      <video-cover-h5
          :sync-time="currentTime"
          :duration="videoDuration"
          :sync-status="playerStatus"
          @handle-edit="handleEdit"
          @handle-hidden="handleHidden"
          @change-time="handleChangeTime"
          @on-changing="handleOnChanging"
          @handle-resume-req="handleResumeReq"
          @handle-restart-req="handleRestartReq"
          @handle-paused-req="handlePausedReq"
          @handle-full-screen="handleFullScreen"
      ></video-cover-h5>
    </view>
    <!-- #endif -->
  </view>
</template>

<script setup>
import {
  ref,
  computed,
  getCurrentInstance,
  onMounted,
  toRefs,
  onBeforeUnmount,
  watch,
} from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import usePlayer, { CUSTOM_PLAY_STATUS_OBJ, PlayerSubNVueEvent } from '@/hooks/usePlayer';
import isUndefined from 'lodash/isUndefined';
import isFunction from 'lodash/isFunction';
import VideoCoverH5 from '@/pages/common/player/VideoControlsH5.vue';

defineOptions({ name: 'ReactiveVideo' });
const emits = defineEmits(['updateTime', 'handleBack', 'handleEdit', 'handleHidden']);
const props = defineProps({
  // 下标索引
  uid: {
    type: [Number, String],
    default: 0,
  },
  width: {
    default: '100%',
    type: String,
  },
  height: {
    default: '100%',
    type: String,
  },
  playUrl: {
    default: '',
    type: String,
  },
  bg: {
    default: 'var(--td-custom-black)',
    type: String,
  },
  autoplay: {
    default: true,
    type: Boolean,
  },
});

const PAGE_VARS = {
  LOG_PREFIX: 'ReactiveVideo',
  TAP_TIMEOUT_NUM: 3 * 1000,
};
const { playerStatus, setPlayerStatus, isStart, isPaused } = usePlayer();
const { playUrl, bg, autoplay, uid } = toRefs(props);
const isInitPlayImg = ref(true); // 是否展示初始播放按钮
const isControls = ref(false);
const instance = getCurrentInstance();
const videoPlayer = ref(null);
const selectorQuery = uni.createSelectorQuery().in(instance.proxy);
// #ifdef APP-PLUS
const subNVue = uni.getSubNVueById('controls');
// #endif

const videoDuration = ref(0); // 获取视频时长: 只取做语音识别的画面时长作为基准
const currentTime = ref(0); // 当前播放时间
const isTap = ref(false); // 是否显示自定义按钮
const tabTimeout = ref();

// 是否展示蒙层
const isShowOverlay = computed(() => {
  return !isInitPlayImg.value && !isTap.value;
});

// 是否展示自定义按钮
const isShowCustomControls = computed(() => {
  return !isInitPlayImg.value && isTap.value;
});

// 外层盒子样式
const styleObj = computed(() => {
  return {
    width: props.width,
    height: props.height,
    background: bg.value,
  };
});

// 触发的参数
const triggerParams = (tempTime = 0) => {
  return {
    time: tempTime || currentTime.value,
    status: playerStatus.value,
    duration: videoDuration.value,
  };
};

// 初始化点击播放
const handleInitPlay = () => {
  if (isInitPlayImg.value) {
    isInitPlayImg.value = false;
  }
  setPlayerStatus(CUSTOM_PLAY_STATUS_OBJ.START);
  triggerVideoInformation();
};

const handlePlay = () => {
  console.log(`${PAGE_VARS.LOG_PREFIX}: handleOnPlay`);

  if (isInitPlayImg.value) {
    isInitPlayImg.value = false;
  }

  setPlayerStatus(CUSTOM_PLAY_STATUS_OBJ.START);
  triggerVideoInformation();
  startTapTimeout();
};
const handlePause = () => {
  console.log(`${PAGE_VARS.LOG_PREFIX}: handleOnPause`);
  setPlayerStatus(CUSTOM_PLAY_STATUS_OBJ.PAUSED);
  triggerVideoInformation();
  startTapTimeout();
};
const handleEnded = () => {
  console.log(`${PAGE_VARS.LOG_PREFIX}: handleOnEnded`);
  setPlayerStatus(CUSTOM_PLAY_STATUS_OBJ.END);
  triggerVideoInformation();
};
const handleUpdateTime = (data) => {
  // 有时间更新代表播放中
  /*if (!isStart(playerStatus.value)) {
  setPlayerStatus(CUSTOM_PLAY_STATUS_OBJ.START);
}*/

  // 播放进度变化时触发，event.detail = {currentTime, duration} 。触发频率 250ms 一次
  const detail = data?.detail || {};
  // 未播放开始前会触发一次，duration为NAN
  if (!videoDuration.value) {
    if (detail?.duration && detail.duration > 0) videoDuration.value = detail.duration;
  }
  currentTime.value = detail.currentTime || 0;
  triggerVideoInformation(currentTime.value);
};

// 触发视频信息事件
const triggerVideoInformation = (time) => {
  const currentParams = triggerParams(time);
  // 触发事件
  emits('updateTime', currentParams);

  // #ifdef APP-PLUS
  uni.$emit(PlayerSubNVueEvent.VideoInformation, currentParams);
  // #endif
};

/**
 * 跳转到指定播放时间
 * @param {object} params
 *
 *   params.time  时间
 *   params.isMillisecond 是否毫秒
 *   示例：
 *  {
 *      chapter: 0,
 *      isMillisecond: true,
 *  }
 */
const setTime = (params) => {
  let { time } = params;

  if (isUndefined(time)) {
    return false;
  }

  const isMillisecond = Object.prototype.hasOwnProperty.call(params, 'isMillisecond')
      ? params.isMillisecond
      : true;

  if (isMillisecond && time !== 0) {
    time /= 1000;
  }

  // 需要整数
  time = Math.round(time);
  console.log(
      `${PAGE_VARS.LOG_PREFIX}: seek time ====>`,
      time,
      videoPlayer.value,
      isFunction(videoPlayer.value.seek),
  );
  videoPlayer.value.seek(time);
};

/**
 * 设置状态
 * @param {number} action 设置状态，播放和暂停
 */
const setStatus = (action) => {
  if (videoPlayer.value) {
    // 设置播放
    if (action === CUSTOM_PLAY_STATUS_OBJ.START) {
      videoPlayer.value?.play();
    }

    // 设置暂停
    if (action === CUSTOM_PLAY_STATUS_OBJ.PAUSED) {
      videoPlayer.value?.pause();
    }
  }
};

const videoErrorCallback = (e) => {
  console.log(`${PAGE_VARS.LOG_PREFIX}: 视频错误信息`, videoPlayer.value, e);
};

const loadeddata = (e) => {
  console.log(`${PAGE_VARS.LOG_PREFIX}: loadeddata`, e);
};

const loadedmetadata = (e) => {
  console.log(`${PAGE_VARS.LOG_PREFIX}: loadedmetadata`, e);
  // #ifdef H5
  videoDuration.value = e.detail?.duration || 0;
  emits('updateTime', triggerParams());
  // #endif
};

const handleHidden = () => {
  emits('handleHidden');
};

const handleBack = () => {
  // #ifdef APP-PLUS
  closeSubControl();
  // #endif
  emits('handleBack');
};

const handleEdit = () => {
  emits('handleEdit');
};

// 拖动滑块时，清除定时器
const handleOnChanging = () => {
  clearTapTimeout();
};
const handleChangeTime = (time) => {
  setTime({ time, isMillisecond: false });
  // 拖动结束，开始定时器
  startTapTimeout();
};

// 重新播放
const handleRestartReq = () => {
  console.log(`${PAGE_VARS.LOG_PREFIX}:handleRestartReq`);
  setStatus(CUSTOM_PLAY_STATUS_OBJ.START);
};
// 暂停后继续播放
const handleResumeReq = () => {
  console.log(`${PAGE_VARS.LOG_PREFIX}:handleResumeReq`);
  setStatus(CUSTOM_PLAY_STATUS_OBJ.START);
};
// 请求暂停
const handlePausedReq = () => {
  console.log(`${PAGE_VARS.LOG_PREFIX}:handlePausedReq`);
  setStatus(CUSTOM_PLAY_STATUS_OBJ.PAUSED);
};

const handleFullScreen = () => {
  videoPlayer.value?.requestFullScreen();
};

const handleControlsToggle = (e) => {
  console.log(`${PAGE_VARS.LOG_PREFIX}: handleControlsToggle`, e.detail.show);
};

const handleFullScreenChange = (e) => {
  console.log(`${PAGE_VARS.LOG_PREFIX}: handleFullScreenChange`, e.detail.fullScreen);
  const { fullScreen } = e.detail;
  // #ifdef APP-PLUS
  if (!fullScreen) {
    isControls.value = false;
  }
  // #endif
};

const handleTap = () => {
  console.log(`${PAGE_VARS.LOG_PREFIX}: handleTap: isTap change before(${isTap.value})`);
  isTap.value = !isTap.value;

  // 如果是显示状态
  if (isTap.value) {
    startTapTimeout();
  }
};

const handleCustomTap = () => {
  console.log(`${PAGE_VARS.LOG_PREFIX}: handleCustomTap: isTap change before(${isTap.value})`);
  isTap.value = !isTap.value;
};

const handletouchstart = () => {
  console.log(`${PAGE_VARS.LOG_PREFIX}: handletouchstart`);
};

const startTapTimeout = () => {
  clearTapTimeout();
  tabTimeout.value = setTimeout(() => {
    isTap.value = false;
  }, PAGE_VARS.TAP_TIMEOUT_NUM);
};

const clearTapTimeout = () => {
  if (tabTimeout.value) {
    clearTimeout(tabTimeout.value);
    tabTimeout.value = null;
  }
};

// 子窗体事件
const onSubControlsHandler = (data) => {
  const { event, params } = data;
  switch (event) {
    case 'handleCustomTap':
      handleCustomTap();
      break;
    case 'handleEdit':
      closeSubControl();
      handleEdit();
      break;
    case 'handleHidden':
      closeSubControl();
      handleHidden();
      break;
    case 'handleFullScreen':
      isControls.value = true;
      videoPlayer.value?.requestFullScreen();
      break;
    case 'changeTime':
      handleChangeTime(params);
      break;
    case 'onChanging':
      handleOnChanging();
      break;
    case 'handlePausedReq':
      handlePausedReq();
      break;
    case 'handleResumeReq':
      handleResumeReq();
      break;
    case 'handleRestartReq':
      handleRestartReq();
      break;
    default:
      break;
  }
};

// 打开子窗体
const openSubControl = () => {
  subNVue?.show('fade-in', 200);
};

// 关闭子窗体
const closeSubControl = () => {
  subNVue?.hide('none');
};

// 设置子窗体样式

watch(
    () => isTap.value,
    (val) => {
      // #ifdef APP-PLUS
      if (val) {
        openSubControl();
      } else {
        closeSubControl();
      }
      // #endif
    },
);

watch(
    () => playUrl.value,
    () => {
      videoDuration.value = 0;
    },
);

onLoad(() => {
  // 隐藏子窗体
  // #ifdef APP-PLUS
  closeSubControl();
  // #endif
});

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync();
  videoPlayer.value = uni.createVideoContext(`sVideo${uid.value}`, instance);
  // 监听事件
  // #ifdef APP-PLUS
  // 设置样式
  subNVue?.setStyle({
    top: systemInfo.statusBarHeight + 'px',
  });
  uni.$on(PlayerSubNVueEvent.SubControlsAction, onSubControlsHandler);
  // #endif
});

onBeforeUnmount(() => {
  // #ifdef APP-PLUS
  uni.$off(PlayerSubNVueEvent.SubControlsAction, onSubControlsHandler);
  // #endif
});

defineExpose({
  setTime,
  setStatus,
});
</script>

<style scoped lang="scss">
$imgSize: 24px;
$top: 13px;
$left: 16px;

.reactive-video {
  position: relative;

  &__h5cover {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    z-index: 2;
  }
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1; /* 确保覆盖在视频上方 */
}

.init-play-img {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  z-index: 2; /* 确保覆盖在视频上方 */
}

.back-img {
  width: #{$imgSize};
  height: #{$imgSize};
  position: absolute;
  left: #{$left};
  top: #{$top};
  z-index: 3;
}
</style>
