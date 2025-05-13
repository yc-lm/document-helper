<template>
  <div class="wrapper">
    <upload-file></upload-file>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import UploadFile from "./components/UploadFile.vue";
</script>

<style lang="scss" scoped>
.wrapper {
  width: 100vw;
  height: 100vh;
}
</style>
