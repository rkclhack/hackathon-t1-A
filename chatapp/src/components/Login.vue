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
　<div class="container">
    <div class="left">
      <div class="logo-area">
        <img src="../images/logo.png" alt="ロゴ" class="chat-logo" />
      </div>
      <h1>個別指導塾「Black」</h1>
      
    </div>
    <div class="right">
      <!-- Google認証 -->
      <button 
        type="button" 
        @click="onGoogleSignIn" 
        :disabled="isLoading"
      >
        <span v-if="isLoading">認証中...</span>
        <span v-else>Googleでログイン</span>
      </button>
      
      
    </div>
  </div>
  

</template>

<style scoped>
body {
  margin: 0;
  padding: 0;
  font-family: 'Noto Sans JP', sans-serif;
  background-color: #0A0A0A;
  color: #FFFFFF;
}

/* コンテナ：PCでは横並び、スマホでは縦並び */
.container {
  display: flex;
  flex-direction: row;
  height: 100vh;
}

.left {
  flex: 1;
  background-color: #0A0A0A;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 3rem;
  text-align: center;
}

.left img {
  max-width: 180px;
  margin-bottom: 1.5rem;
}

.left h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.left p {
  font-size: 1rem;
  color: #CCCCCC;
}

/* 右：フォーム部分 */
.right {
  flex: 1;
  background-color: #111111;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 3rem;
}

.right input {
  width: 80%;
  max-width: 400px;
  padding: 12px;
  margin-bottom: 1.2rem;
  font-size: 1rem;
  border: 1px solid #333;
  border-radius: 5px;
  background-color: #FFFFFF;
  color: #000000;
}

.right button {
  width: 80%;
  max-width: 400px;
  padding: 12px;
  font-size: 1rem;
  font-weight: bold;
  background-color: #FFD700;
  color: #000000;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.right button:hover {
  background-color: #FFC300;
}

.right p {
  margin-top: 1rem;
  font-size: 0.9rem;
  color: #AAAAAA;
}

/* スマホ対応 */
@media screen and (max-width: 768px) {
  .container {
    flex-direction: column;
  }

  .left, .right {
    flex: none;
    width: 100%;
  }

  .left {
    padding: 2rem;
  }

  .right {
    padding: 2rem;
  }

  .right input,
  .right button {
    width: 90%;
  }

  .left h1 {
    font-size: 1.5rem;
  }

  .left p {
    font-size: 0.9rem;
  }
}


</style>
