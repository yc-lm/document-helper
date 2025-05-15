<!--
@name: MindMap.vue
@author: yangcongcong
@date: 2025/5/15
@description: 描述
-->
<template>
  <div :id="props.id" ref="mindRef" class="mind-map"></div>
</template>
<script setup lang="ts">
import { ref, unref, watch,nextTick } from 'vue';
import 'jsmind/style/jsmind.css';
// @ts-ignore
import JsMind from 'jsmind';

defineOptions({ name: 'MindMap' });

const jsmind = ref();

const props = defineProps({
  id: {
    type: String,
    default: 'mindMap',
  },
  designSummary: {
    type: Array,
    default: () => [{
      id: 'root',
      topic: '这是思维导图',
      children: [
        {
          id: '1',
          topic: '章节1',
        },
        {
          id: '2',
          topic: '章节2',
          children: [
            {
              id: '3',
              topic: '章节2-1',
            },
          ]
        },
        {
          id: '6',
          topic: '章节3',
        },
      ]
    }],
  },
});

const initMind = (val: string) => {
  const option = {
    container: document.getElementById(val),
    mode: 'full',
    view: {
      hmargin: 100,
      vmargin: 100,
      line_width: 1,
      engine: 'canvas',
      node_overflow: 'wrap',
      enable_device_pixel_ratio: true,
      zoom: {
        min: 0.1,
        max: 3,
        step: 0.1,
      },
      // custom_node_render: function (jm, element, node) {
      //   console.error(jm)
      //   console.error(element)
      //   element.style.border = '1px solid #38C41A'
      //   console.error(node)
      //   return true
      // }
    },
  };
  const data = unref(props.designSummary)[0] ?? {};
  console.log(data,'data')
  const mind = {
    meta: {
      name: '',
      author: 'http://www.etah-tech.com/',
      version: '0.1',
    },
    format: 'node_tree',
    data: data,
  };

  jsmind.value = new JsMind(option);
  if (unref(props.designSummary)[0]) {
    jsmind.value.show(mind);
  }
};

watch(
  () => [props.designSummary, props.id],
  async (val) => {
    await nextTick();
    if (val[0] && val[0].length) {
      initMind(props.id);
    }
  },
  { deep: true, immediate: true },
);
</script>
<style scoped lang="scss">
.mind-map {
  height: 350px ;
  width: 100%;

  :deep(jmnodes) {
    jmnode {
      box-shadow: none;
      line-height: 1.5;

      &.selected {
        background: var(--td-brand-color-6);
        border: 2px solid var(--td-brand-color-6);
      }

      &:first-of-type {
        border: 2px solid #38c41a;

        &.selected {
          border: 2px solid var(--td-brand-color-6);
        }
      }
    }
  }
}
</style>
