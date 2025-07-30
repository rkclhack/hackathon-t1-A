<script setup>
import { inject, ref, reactive, onMounted, computed } from "vue"
import ChatService from '../services/ChatService.js'
import AuthService from '../services/AuthService.js'

// #region global state
const userName = inject("userName")
// #endregion

// #region reactive variable
const chatContent = ref("")
const chatList = reactive([])
const reversedChatList = computed(() => [...chatList].reverse())
// #endregion

// #region lifecycle
onMounted(() => {
  registerSocketEvent()
})
// #endregion

// #region browser event handler
// 投稿メッセージをサーバに送信する
const onPublish = async () =>  {
  try {
    await ChatService.publish(chatContent.value, userName.value)
    chatContent.value = ""
  } catch (error) {
    console.error('メッセージの投稿に失敗しました:', error)
    alert('メッセージの投稿に失敗しました。もう一度お試しください。')
  }
}

// 退室メッセージをサーバに送信する
const onExit = async () => {
  try {
    await ChatService.exit(userName.value)
    
    // Firebase認証済みユーザーの場合はサインアウトも実行
    if (AuthService.isAuthenticated()) {
      await AuthService.signOut()
    }
  } catch (error) {
    console.error('退室処理でエラーが発生しました:', error)
    // 退室時のエラーは画面遷移を妨げないようにする
  }
}

// メモを画面上に表示する
const onMemo = () => {
  const memoMessage = `${userName.value}さんのメモ:${chatContent.value}`
  chatList.push(memoMessage)
  chatContent.value = ""
}
// #endregion

// #region socket event handler
// サーバから受信した入室メッセージ画面上に表示する
const onReceiveEnter = (data) => {
  const message = `${data}さんが入室しました。`
  chatList.push(message)
}

// サーバから受信した退室メッセージを受け取り画面上に表示する
const onReceiveExit = (data) => {
  const message = `${data}さんが退室しました。`
  chatList.push(message)
}

// サーバから受信した投稿メッセージを画面上に表示する
const onReceivePublish = (data) => {
  const publishMessage = `${data.publisherName}さん:${data.message}`
  chatList.push(publishMessage)
}
// #endregion

// #region local methods
// イベント登録をまとめる
const registerSocketEvent = () => {
  // 入室イベントを受け取ったら実行
  ChatService.onEnter((data) => {
    onReceiveEnter(data)
  })

  // 退室イベントを受け取ったら実行
  ChatService.onExit((data) => {
    onReceiveExit(data)
  })

  // 投稿イベントを受け取ったら実行
  ChatService.onPublish((data) => {
    onReceivePublish(data)
  })
}
// #endregion
</script>

<template>
  <div class="mx-auto my-5 px-4">
    <h1 class="text-h3 font-weight-medium">Vue.js Chat チャットルーム</h1>
    <div class="mt-10">
      <p>ログインユーザ：{{ userName }}さん</p>
      <textarea variant="outlined" placeholder="投稿文を入力してください" rows="4" class="area" type="text" v-model="chatContent"></textarea>
      <div class="mt-5">
        <button class="button-normal" @click="onPublish">投稿</button>
        <button class="button-normal util-ml-8px" @click="onMemo">メモ</button>
      </div>
      <div class="mt-5" v-if="chatList.length !== 0">
        <ul>
          <li class="item mt-4" v-for="(chat, i) in reversedChatList" :key="i">{{ chat }}</li>
        </ul>
      </div>
    </div>
    <router-link to="/" class="link">
      <button type="button" class="button-normal button-exit" @click="onExit">退室する</button>
    </router-link>
  </div>
</template>

<style scoped>
.link {
  text-decoration: none;
}

.area {
  width: 500px;
  border: 1px solid #000;
  margin-top: 8px;
}

.item {
  display: block;
}

.util-ml-8px {
  margin-left: 8px;
}

.button-exit {
  color: #000;
  margin-top: 8px;
}
</style>