<script setup>
import { inject, ref, reactive, onMounted, computed } from "vue"
import ChatService from '../services/ChatService.js'

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
const onPublish = () =>  {
  ChatService.publish(chatContent.value, userName.value)
  chatContent.value = ""
}

// 退室メッセージをサーバに送信する
const onExit = () => {
  ChatService.exit(userName.value)
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

  // CtrlあるいはCommandキーとEnter同時押しで送信
  const handleKeydownEnter = (e) => {
    if (e.ctrlKey || e.metaKey) {
      onPublish()
    }
  }

// #endregion
</script>

<template>
  <div class="mx-auto my-5 px-4">
    <h1 class="text-h3 font-weight-medium">Vue.js Chat チャットルーム</h1>
    <div class="mt-10">
      <p>ログインユーザ：{{ userName }}さん</p>
      <textarea variant="outlined" placeholder="投稿文を入力してください" rows="4" class="area" type="text" v-model="chatContent" @keydown.enter="handleKeydownEnter"></textarea>
      <div class="mt-5">
        <button class="button-normal" @click="onPublish">投稿</button>
        <button class="button-normal util-ml-8px" @click="onMemo">メモ</button>
      </div>
      <div class="mt-5" v-if="chatList.length !== 0">
        <ul>
          <li class="chat-item" v-for="(chatString, i) in reversedChatList" :key="i">
            <template v-if="chatString.includes(':')">
              <span class="chat-publisher">{{ chatString.substring(0, chatString.indexOf(':') + 1) }}</span>
              <span class="chat-content chat-message-display">{{ chatString.substring(chatString.indexOf(':') + 1) }}</span>
            </template>
            <template v-else>
              <span class="chat-content chat-message-display">{{ chatString }}</span>
            </template>
          </li>
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

/* === 追加 === */
.chat-item {
  display: flex; /* Flexboxコンテナにする */
  align-items: flex-start; /* アイテムを上端に揃える */
  margin-top: 16px; /* item mt-4 の代わりに直接マージンを設定 */
}

.chat-publisher {
  flex-shrink: 0; /* 投稿者名が縮まないようにする */
  margin-right: 5px; /* 投稿者名とメッセージの間に少しスペース */
  display: block;
}

.chat-content {
  flex-grow: 1; /* 残りのスペースを全て占有させる */
  min-width: 0; /* 内容がはみ出さないようにする*/
  display: block;
}

.chat-message-display { /*改行*/
  white-space: pre-wrap;
  word-wrap: break-word; 
  overflow-wrap: break-word; 
}
/*===ここまで追加===*/


.util-ml-8px {
  margin-left: 8px;
}

.button-exit {
  color: #000;
  margin-top: 8px;
}
</style>