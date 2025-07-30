<script setup>
import { inject, ref } from "vue"
import { useRouter } from "vue-router"
import ChatService from '../services/ChatService.js'
import AuthService from '../services/AuthService.js'

// #region global state
const userName = inject("userName")
// #endregion

// #region local variable
const router = useRouter()
// #endregion

// #region reactive variable
const inputUserName = ref("")
const isLoading = ref(false)
// #endregion

// #region browser event handler
// Google認証でログイン
const onGoogleSignIn = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  try {
    const user = await AuthService.signInWithGoogle()
    const displayName = AuthService.getUserName()
    
    // 入室メッセージを送信
    await ChatService.enter(displayName)
    
    // 全体で使用するnameに認証済みユーザー名を格納
    userName.value = displayName
    
    // チャット画面へ遷移
    router.push({ name: "chat" })
  } catch (error) {
    console.error('Google認証でエラーが発生しました:', error)
    alert('Google認証に失敗しました。もう一度お試しください。')
  } finally {
    isLoading.value = false
  }
}

// 従来のユーザー名入力でのログイン（デモ用）
const onEnter = async () => {
  // ユーザー名が入力されているかチェック
  if (!inputUserName.value) {
    alert("ユーザー名を入力してください。")
    return
  }
  
  try {
    // 入室メッセージを送信
    await ChatService.enter(inputUserName.value)

    // 全体で使用するnameに入力されたユーザー名を格納
    userName.value = inputUserName.value

    // チャット画面へ遷移
    router.push({ name: "chat" })
  } catch (error) {
    console.error('入室処理でエラーが発生しました:', error)
    alert('入室に失敗しました。もう一度お試しください。')
  }
}
// #endregion
</script>

<template>
  <div class="mx-auto my-5 px-4">
    <h1 class="text-h3 font-weight-medium">Vue.js Chat サンプル</h1>
    
    <!-- Google認証 -->
    <div class="mt-10">
      <p class="mb-4">推奨: Google アカウントでログイン</p>
      <button 
        type="button" 
        @click="onGoogleSignIn" 
        :disabled="isLoading"
        class="button-google"
      >
        <span v-if="isLoading">認証中...</span>
        <span v-else>Googleでログイン</span>
      </button>
    </div>

    <!-- 従来のユーザー名入力（デモ用） -->
    <div class="mt-10">
      <p class="mb-2">または、ユーザー名を入力</p>
      <input type="text" class="user-name-text" v-model="inputUserName" placeholder="ユーザー名" />
      <br />
      <button type="button" @click="onEnter" class="button-normal">入室する</button>
    </div>
  </div>
</template>

<style scoped>
.user-name-text {
  width: 200px;
  border: 1px solid #888;
  margin-bottom: 16px;
  padding: 8px;
}

.button-google {
  background-color: #4285f4;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  margin-bottom: 20px;
}

.button-google:hover {
  background-color: #357ae8;
}

.button-google:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.button-normal {
  background-color: #42b883;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.button-normal:hover {
  background-color: #369870;
}
</style>
