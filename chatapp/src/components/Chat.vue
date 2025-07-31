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
const isNewestFirst = ref(true)
const selectedImage = ref(null)
const isUploading = ref(false)
const fileInput = ref(null)

// 並び順に応じたリストを計算
const sortedChatList = computed(() => {
  return isNewestFirst.value ? [...chatList].reverse() : [...chatList]
})

// 並び順を切り替える
const toggleSortOrder = () => {
  isNewestFirst.value = !isNewestFirst.value
}
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
    
    const trimmedContent = chatContent.value.trim()
    
    // 厳密なバリデーション：空文字列、スペースのみ、改行のみをチェック
    if (!trimmedContent || trimmedContent.length === 0) {
      // 画像がない場合はメッセージが必須
      if (!imageUrl) {
        // メッセージなし・画像なしの場合はサイレントに処理終了
        return
      }
    }
    
    // メッセージまたは画像のいずれかがある場合のみ送信
    if (trimmedContent || imageUrl) {
      await ChatService.publish(trimmedContent, userName.value, imageUrl)
      chatContent.value = ""
      resetFileInput()
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
  // 入力内容をトリム（前後の空白を除去）
  const trimmedContent = chatContent.value.trim()
  
  // 空文字列、スペースのみ、改行のみをチェック
  if (!trimmedContent || trimmedContent.length === 0) {
    // オプション: ユーザーにアラートを表示
    // alert("メモ内容を入力してください")
    return
  }
  
  const memoMessage = `${userName.value}さんのメモ:${trimmedContent}`
  chatList.push(memoMessage)
  chatContent.value = ""
  resetFileInput()
}

// 画像ファイル選択処理
const onImageSelect = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  selectedImage.value = file
}

// ファイル入力をリセット
const resetFileInput = () => {
  selectedImage.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
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
        <button class="button-normal util-ml-8px" @click="toggleSortOrder">
          {{ isNewestFirst ? "古い順にする" : "新しい順にする" }}
        </button>
      </div>
      <div class="mt-5" v-if="chatList.length !== 0">
        <ul>
          <li class="chat-item" v-for="(chat, i) in sortedChatList" :key="i">
            <!-- 通常のメッセージ（文字列）の場合 -->
            <template v-if="typeof chat === 'string'">
              <template v-if="chat.includes(':')">
                <span class="chat-publisher">{{ chat.substring(0, chat.indexOf(':') + 1) }}</span>
                <span class="chat-content chat-message-display">{{ chat.substring(chat.indexOf(':') + 1) }}</span>
              </template>
              <template v-else>
                <span class="chat-content chat-message-display">{{ chat }}</span>
              </template>
            </template>
            <!-- 画像付きメッセージ（オブジェクト）の場合 -->
            <template v-else>
              <div class="message-container">
                <div class="message-header">
                  {{ chat.publisherName }}さん:
                </div>
                <div v-if="chat.message" class="message-text chat-message-display">
                  {{ chat.message }}
                </div>
                <div v-if="chat.imageUrl" class="message-image">
                  <img :src="chat.imageUrl" alt="アップロード画像" class="uploaded-image" />
                </div>
              </div>
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
  flex-grow: 1; /* 残りのスペースを全て占有させる */
  min-width: 0; /* 内容がはみ出さないようにする*/
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