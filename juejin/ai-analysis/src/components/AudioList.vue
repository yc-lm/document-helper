<!--
@name: AudioList.vue
@author: yangcongcong
@date: 2025/5/15
@description: 描述
-->
<template>
  <t-space direction="vertical" size="large">
    <t-list :split="true">
      <t-list-item v-for="(item, index) in list" :key="index">
        <t-list-item-meta :title="formatVideoTime(item.start/ 1000)" :description="item.text_seg" />
      </t-list-item>
    </t-list>
  </t-space>
</template>
<script setup>
import { formatVideoTime } from '../utils/time';
defineOptions({ name: 'AudioList' });
const props = defineProps({
  list: {
    type: Array,
    default: () => [],
  },
});
</script>
<style scoped lang="scss"></style>
