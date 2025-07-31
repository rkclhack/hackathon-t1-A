<script setup>
import { inject, ref, reactive, onMounted, computed } from "vue"
import ChatService from '../services/ChatService.js'
import AuthService from '../services/AuthService.js'
import ImageService from '../services/ImageService.js'

// #region global state
const userName = inject("userName")
// #endregion

// #region reactive variable
const chatContent = ref("")
const chatList = reactive([])
const reversedChatList = computed(() => [...chatList].reverse())
const selectedImage = ref(null)
const isUploading = ref(false)
const fileInput = ref(null)
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
    isUploading.value = true
    let imageUrl = null
    
    // 画像が選択されている場合はアップロード
    if (selectedImage.value) {
      imageUrl = await ImageService.uploadImage(selectedImage.value, userName.value)
    }
    
    // メッセージまたは画像のいずれかがある場合のみ送信
    if (chatContent.value.trim() || imageUrl) {
      await ChatService.publish(chatContent.value, userName.value, imageUrl)
      chatContent.value = ""
      resetFileInput()
    } else {
      alert('メッセージまたは画像を選択してください。')
    }
  } catch (error) {
    console.error('投稿に失敗しました:', error)
    alert('投稿に失敗しました。もう一度お試しください。')
  } finally {
    isUploading.value = false
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
  resetFileInput()
}

// 画像ファイル選択処理
const onImageSelect = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
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
  const messageObj = {
    publisherName: data.publisherName,
    message: data.message,
    imageUrl: data.imageUrl || null,
    type: 'message'
  }
  chatList.push(messageObj)
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
      
      <!-- 画像選択部分 -->
      <div class="mt-3">
        <input 
          ref="fileInput"
          type="file" 
          accept="image/*" 
          @change="onImageSelect"
          class="file-input"
        />
        <div v-if="selectedImage" class="selected-image-info">
          選択された画像: {{ selectedImage.name }}
        </div>
      </div>
      
      <div class="mt-5">
        <button 
          class="button-normal" 
          @click="onPublish"
          :disabled="isUploading"
        >
          {{ isUploading ? 'アップロード中...' : '投稿' }}
        </button>
        <button class="button-normal util-ml-8px" @click="onMemo">メモ</button>
      </div>
      <div class="mt-5" v-if="chatList.length !== 0">
        <ul>
          <li class="item mt-4" v-for="(chat, i) in reversedChatList" :key="i">
            <!-- 通常のメッセージ（文字列）の場合 -->
            <div v-if="typeof chat === 'string'">
              {{ chat }}
            </div>
            <!-- 画像付きメッセージ（オブジェクト）の場合 -->
            <div v-else class="message-container">
              <div class="message-header">
                {{ chat.publisherName }}さん:
              </div>
              <div v-if="chat.message" class="message-text">
                {{ chat.message }}
              </div>
              <div v-if="chat.imageUrl" class="message-image">
                <img :src="chat.imageUrl" alt="アップロード画像" class="uploaded-image" />
              </div>
            </div>
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

.file-input {
  margin-top: 8px;
  padding: 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.selected-image-info {
  margin-top: 4px;
  font-size: 14px;
  color: #666;
}

.message-container {
  padding-left: 8px;
}

.message-header {
  font-weight: bold;
  margin-bottom: 4px;
}

.message-text {
  margin-bottom: 8px;
}

.message-image {
  margin-top: 8px;
}

.uploaded-image {
  max-width: 300px;
  max-height: 200px;
  border-radius: 8px;
  border: 1px solid #ddd;
}
</style>