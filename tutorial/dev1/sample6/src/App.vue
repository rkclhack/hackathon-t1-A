<script setup>
import { ref, provide } from "vue"

const message = ref("Hello Vue.js!")
provide("message", message)

</script>

<template>
  <router-view></router-view>
</template>