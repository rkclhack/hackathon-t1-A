<script setup>
import { inject, ref, reactive, onMounted, computed } from "vue"
import { useRouter } from 'vue-router'
import ChatService from '../services/ChatService.js'
import AuthService from '../services/AuthService.js'
import ImageService from '../services/ImageService.js'

// #region global state
const userName = inject("userName")
const router = useRouter()
// #endregion

// #region reactive variable
const chatContent = ref("")
const chatList = reactive([])
const isNewestFirst = ref(true)
const selectedImage = ref(null)
const isUploading = ref(false)
const fileInput = ref(null)
const expirationDate = ref("")

// タグ選択を追加
const selectedTags = ref([])

// サイドバー・チャンネル機能
const currentChannel = ref("general")
const isSidebarOpen = ref(true)
const channels = ref([
  { id: "general", name: "一般", description: "全般的な話題", icon: "💬", color: "#28a745" },
  { id: "tech", name: "技術", description: "技術的な話題", icon: "💻", color: "#007bff" },
  { id: "random", name: "雑談", description: "自由な雑談", icon: "🎉", color: "#ffc107" },
  { id: "announcement", name: "お知らせ", description: "重要なお知らせ", icon: "📢", color: "#dc3545" }
])

// チャンネル別のメッセージを管理
const channelMessages = reactive({
  general: [],
  tech: [],
  random: [],
  announcement: []
})

// 現在のチャンネルのメッセージを計算
const currentChannelMessages = computed(() => {
  return channelMessages[currentChannel.value] || []
})

// 現在のチャンネル情報を取得（安全性を向上）
const getCurrentChannelInfo = computed(() => {
  return channels.value.find(ch => ch.id === currentChannel.value) || {
    id: "general",
    name: "一般",
    description: "全般的な話題",
    icon: "💬",
    color: "#28a745"
  }
})

// チャンネルを切り替える
const switchChannel = (channelId) => {
  if (currentChannel.value !== channelId) {
    currentChannel.value = channelId
  }
}

// サイドバーの開閉を切り替える
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

// 並び順に応じたリストを計算（チャンネル別メッセージを使用）
const sortedChatList = computed(() => {
  const messages = currentChannelMessages.value || []
  return isNewestFirst.value ? [...messages].reverse() : [...messages]
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
const onPublish = async () => {
  try {
    isUploading.value = true
    let imageUrl = null

    // 画像が選択されている場合はアップロード
    if (selectedImage.value) {
      imageUrl = await ImageService.uploadImage(selectedImage.value, userName.value)
    }

    const content = chatContent.value
    const trimmedContent = content.trim()

    // バリデーション：トリム後が空の場合をチェック
    if (!trimmedContent || trimmedContent.length === 0) {
      if (!imageUrl) {
        return
      }
    }

    // 元の入力内容（空白含む）を送信
    if (content || imageUrl) {
      // ChatServiceのpublishメソッドの引数を修正
      await ChatService.publish(content, userName.value, imageUrl)

      // チャンネル別メッセージに追加
      const messageObj = {
        publisherName: userName.value,
        message: content,
        imageUrl: imageUrl,
        channel: currentChannel.value,
        tags: selectedTags.value,
        expirationDate: expirationDate.value,
        type: 'message'
      }
      channelMessages[currentChannel.value].push(messageObj)

      chatContent.value = ""
      expirationDate.value = ""
      selectedTags.value = []
      resetFileInput()
    }
  } catch (error) {
    console.error('投稿に失敗しました:', error)
    alert('投稿に失敗しました。もう一度お試しください。')
  } finally {
    isUploading.value = false
  }
}

// メモを画面上に表示する
const onMemo = () => {
  const content = chatContent.value
  const trimmedContent = content.trim()

  if (!trimmedContent || trimmedContent.length === 0) {
    return
  }

  const memoMessage = `${userName.value}さんのメモ:${content}`
  channelMessages[currentChannel.value].push(memoMessage)
  chatContent.value = ""
  resetFileInput()
}

// 退室処理
const onExit = async () => {
  try {
    await ChatService.exit(userName.value)

    if (AuthService.isAuthenticated()) {
      await AuthService.signOut()
    }

    router.push('/')
  } catch (error) {
    console.error('退室処理でエラーが発生しました:', error)
    router.push('/')
  }
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
// サーバから受信した入室メッセージを画面上に表示する
const onReceiveEnter = (data) => {
  try {
    const message = `${data.userName || data}さんが${getCurrentChannelInfo.value.name}チャンネルに入室しました。`
    channelMessages[data.channel || currentChannel.value].push(message)
  } catch (error) {
    console.error('入室メッセージ処理エラー:', error)
  }
}

// サーバから受信した退室メッセージを受け取り画面上に表示する
const onReceiveExit = (data) => {
  try {
    const message = `${data.userName || data}さんが${getCurrentChannelInfo.value.name}チャンネルから退室しました。`
    channelMessages[data.channel || currentChannel.value].push(message)
  } catch (error) {
    console.error('退室メッセージ処理エラー:', error)
  }
}

// サーバから受信した投稿メッセージを画面上に表示する
const onReceivePublish = (data) => {
  try {
    const messageObj = {
      publisherName: data.publisherName,
      message: data.message,
      userID: data.userID,
      channelID: data.channelID,
      tag: data.tag || [],
      imageUrl: data.imageUrl || null,
      channel: data.channel || 'general',
      type: 'message'
    }
    // 対応するチャンネルに追加
    const targetChannel = data.channel || 'general'
    if (channelMessages[targetChannel]) {
      channelMessages[targetChannel].push(messageObj)
    }
  } catch (error) {
    console.error('投稿メッセージ処理エラー:', error)
  }
}
// #endregion

// #region local methods
// イベント登録をまとめる
const registerSocketEvent = () => {
  try {
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
  } catch (error) {
    console.error('イベント登録エラー:', error)
  }
}

// CtrlあるいはCommandキーとEnter同時押しで送信
const handleKeydownEnter = (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    onPublish()
  }
}
// #endregion
</script>

<template>
  <div class="chat-app">
    <!-- サイドバー -->
    <div class="sidebar" :class="{ 'sidebar-closed': !isSidebarOpen }">
      <div class="sidebar-header">
        <h3>チャンネル</h3>
        <button class="sidebar-toggle" @click="toggleSidebar">
          {{ isSidebarOpen ? '◀' : '▶' }}
        </button>
      </div>

      <div class="sidebar-content" v-if="isSidebarOpen">
        <div class="user-info">
          <div class="user-avatar">{{ userName ? userName.charAt(0).toUpperCase() : 'U' }}</div>
          <div class="user-name">{{ userName }}さん</div>
        </div>

        <div class="channel-list">
          <div v-for="channel in channels" :key="channel.id" class="channel-item"
            :class="{ 'active': currentChannel === channel.id }" @click="switchChannel(channel.id)">
            <span class="channel-icon">{{ channel.icon }}</span>
            <div class="channel-info">
              <div class="channel-name"># {{ channel.name }}</div>
              <div class="channel-desc">{{ channel.description }}</div>
            </div>
            <div class="channel-indicator" :style="{ backgroundColor: channel.color }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- メインコンテンツ -->
    <div class="main-content" :class="{ 'main-content-full': !isSidebarOpen }">
      <div class="search-section">
        <v-combobox label="ラベル検索" :items="['California', 'Colorado', 'Florida', 'Georgia', 'Texas', 'Wyoming']"
          class="search-combobox"></v-combobox>
      </div>
      <div class="chat-header">
        <div class="current-channel">
          <span class="current-channel-icon">{{ getCurrentChannelInfo.icon }}</span>
          <h1 class="current-channel-name"># {{ getCurrentChannelInfo.name }}</h1>
          <span class="current-channel-desc">{{ getCurrentChannelInfo.description }}</span>
        </div>
      </div>


      <div class="chat-container">

        <!-- メッセージ表示エリア -->
        <div class="messages-area">
          <div v-if="currentChannelMessages.length === 0" class="no-messages">
            <p>{{ getCurrentChannelInfo.icon }} # {{ getCurrentChannelInfo.name }} チャンネルにはまだメッセージがありません</p>
            <p>最初のメッセージを投稿してみましょう！</p>
          </div>
          <ul v-else class="message-list">
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

        <!-- 入力エリア -->
        <div class="input-area">
          <p class="user-status">ログインユーザ：{{ userName }}さん</p>

          <!-- タグ選択 -->
          <div class="tag-section">
            <label>タグ選択:</label>
            <select multiple v-model="selectedTags" class="tag-select">
              <option value="announce">お知らせ</option>
              <option value="attendance">出欠</option>
              <option value="student">生徒名</option>
              <option value="teacher">担当教師名</option>
              <option value="important">重要度</option>
            </select>
          </div>

          <!-- 有効期間選択 -->
          <div class="expiration-section">
            <label class="expiration-label">
              有効期間を選択してください（オプション）:
              <input type="date" name="expiration" v-model="expirationDate" class="date-input"
                :min="new Date().toISOString().split('T')[0]" />
            </label>
          </div>

          <!-- メッセージ入力 -->
          <textarea :placeholder="`# ${getCurrentChannelInfo.name} に投稿...`" rows="4" class="area" v-model="chatContent"
            @keydown.enter="handleKeydownEnter"></textarea>

          <!-- 画像選択部分 -->
          <div class="image-section">
            <input ref="fileInput" type="file" accept="image/*" @change="onImageSelect" class="file-input" />
            <div v-if="selectedImage" class="selected-image-info">
              選択された画像: {{ selectedImage.name }}
            </div>
          </div>

          <!-- ボタングループ -->
          <div class="button-group">
            <button class="button-normal button-primary" @click="onPublish" :disabled="isUploading">
              {{ isUploading ? 'アップロード中...' : '投稿' }}
            </button>
            <button class="button-normal" @click="onMemo">メモ</button>
            <button class="button-normal" @click="toggleSortOrder">
              {{ isNewestFirst ? "古い順" : "新しい順" }}
            </button>
            <button type="button" class="button-normal button-exit" @click="onExit">
              退室する
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<!-- CSSは既存のものをそのまま使用 -->
<style scoped>
/* 既存のスタイルをそのまま維持 */
.chat-app {
  display: flex;
  height: 100vh;
  background-color: #f5f5f5;
}

/* 以下、既存のスタイルと同じ... */
.sidebar {
  width: 280px;
  background-color: #2c3e50;
  color: white;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.sidebar-closed {
  width: 60px;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #34495e;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
}

.sidebar-toggle {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 16px;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
}

.user-info {
  padding: 16px;
  border-bottom: 1px solid #34495e;
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #3498db;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 18px;
}

.user-name {
  font-size: 16px;
  font-weight: 500;
}

.channel-list {
  padding: 8px 0;
}

.channel-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

.channel-item:hover {
  background-color: #34495e;
}

.channel-item.active {
  background-color: #3498db;
}

.channel-icon {
  font-size: 20px;
  width: 24px;
  text-align: center;
}

.channel-info {
  flex: 1;
}

.channel-name {
  font-weight: 500;
  font-size: 14px;
}

.channel-desc {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 2px;
}

.channel-indicator {
  width: 4px;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.channel-item.active .channel-indicator {
  opacity: 1;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.main-content-full {
  margin-left: 0;
}

.chat-header {
  background-color: white;
  padding: 16px 24px;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.current-channel {
  display: flex;
  align-items: center;
  gap: 12px;
}

.current-channel-icon {
  font-size: 24px;
}

.current-channel-name {
  margin: 0;
  font-size: 24px;
  color: #2c3e50;
}

.current-channel-desc {
  color: #7f8c8d;
  font-size: 14px;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: white;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.no-messages {
  text-align: center;
  color: #7f8c8d;
  padding: 40px 20px;
}

.message-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.input-area {
  padding: 20px 24px;
  border-top: 1px solid #e0e0e0;
  background-color: #fafafa;
}

.user-status {
  margin-bottom: 12px;
  font-weight: 500;
}

.tag-section,
.expiration-section,
.image-section {
  margin-bottom: 12px;
}

.tag-select {
  margin-left: 8px;
  padding: 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.expiration-label {
  display: block;
  font-size: 14px;
  color: #333;
}

.date-input {
  margin-left: 8px;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.area {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  resize: vertical;
  min-height: 100px;
  margin-bottom: 12px;
}

.file-input {
  padding: 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.selected-image-info {
  margin-top: 4px;
  font-size: 14px;
  color: #666;
}

.button-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.button-normal {
  padding: 8px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  transition: background-color 0.2s;
}

.button-normal:hover {
  background-color: #f0f0f0;
}

.button-primary {
  background-color: #3498db;
  color: white;
  border-color: #3498db;
}

.button-primary:hover {
  background-color: #2980b9;
}

.button-exit {
  background-color: #e74c3c;
  color: white;
  border-color: #e74c3c;
}

.button-exit:hover {
  background-color: #c0392b;
}

.chat-item {
  display: flex;
  align-items: flex-start;
  margin-top: 16px;
}

.chat-publisher {
  flex-shrink: 0;
  margin-right: 5px;
  display: block;
  font-weight: bold;
  color: #2c3e50;
}

.chat-content {
  flex-grow: 1;
  min-width: 0;
  display: block;
}

.chat-message-display {
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.message-container {
  flex-grow: 1;
  min-width: 0;
  padding-left: 8px;
}

.message-header {
  font-weight: bold;
  margin-bottom: 4px;
  color: #2c3e50;
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

.search-section {
  padding: 16px 24px;
  background-color: white;
  border-bottom: 1px solid #e0e0e0;
}

.search-combobox {
  max-width: 400px;
}
</style>