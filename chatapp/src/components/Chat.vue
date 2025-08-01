<script setup>
import { ref, reactive, onMounted, computed } from "vue"
import { useRouter } from 'vue-router'
import ChatService from '../services/ChatService.js'
import AuthService from '../services/AuthService.js'
import ImageService from '../services/ImageService.js'
import UserService from '../services/UserService.js'

// #region global state
const userName = ref("")
const router = useRouter()
// #endregion

// #region reactive variable
const inputText = ref("")
const chatList = reactive([])
const selectedImage = ref(null)
const isUploading = ref(false)
const fileInput = ref(null)
const expirationDate = ref("")

// タグ選択機能（develop版から継承）
const selectedTags = ref([])
const selectedSearchTags = ref([])

// 詳細検索用の変数を追加
const searchDialog = ref(false)
const searchKeyword = ref("")
const searchTags = ref([])
const searchDateFrom = ref("")
const searchDateTo = ref("")
const searchChannel = ref("")

const showTagDropdown = ref(false)
const showDatePicker = ref(false)
const messagesArea = ref(null)
const messageTextarea = ref(null)

// サイドバー・チャンネル機能（ui_test版デザインを採用、develop版のチャンネルIDに合わせる）
const isSidebarOpen = ref(true)
const channels = ref([
  { id: -1, name: "すべて", description: "全てのメッセージ", icon: "🌐", color: "#6c757d" },
  { id: 0, name: "引継ぎ", description: "引継ぎ事項", icon: "📋", color: "#28a745" },
  { id: 1, name: "シフト", description: "シフト調整", icon: "📅", color: "#007bff" },
  { id: 2, name: "業務連絡", description: "業務に関する連絡", icon: "📢", color: "#ffc107" }
])

// 利用可能なタグリスト（develop版から継承）
const availableTags = ref([
  '田中',
  '高橋',
  '鈴木',
  '体験',
  '出欠',
  '勤怠',
  'シフト設定',
  '重要'
])
const currentChannel = ref(-1) // デフォルトは「すべて」チャンネル


// 現在のチャンネル情報を取得
const getCurrentChannelInfo = computed(() => {
  return channels.value.find(ch => ch.id === currentChannel.value) || {
    id: -1,
    name: "すべて",
    description: "全てのメッセージ",
    icon: "🌐",
    color: "#6c757d"
  }
})

// メッセージのフィルタリング
const filteredChatList = computed(() => {
  const currentChannelId = currentChannel.value;
  const selectedTags = selectedSearchTags.value;
  const dateFrom = searchDateFrom.value ? new Date(searchDateFrom.value) : null;
  const dateTo = searchDateTo.value ? new Date(searchDateTo.value) : null;

  return chatList.filter((message) => {
    // チャンネルIDによるフィルタリング
    if (currentChannelId !== -1 && typeof message !== 'string' && message.channelID !== currentChannelId) {
      return false;
    }

    // タグによるフィルタリング
    if (selectedTags.length > 0) {
      if (!message.tags || !selectedTags.every(tag => message.tags.includes(tag))) {
        return false;
      }
    }

    // 有効日によるフィルタリング
    if (dateFrom || dateTo) {
      const expirationDate = message.expirationDate ? new Date(message.expirationDate) : null;

      if (expirationDate) {
        if (dateFrom && expirationDate < dateFrom) {
          return false;
        }
        if (dateTo && expirationDate > dateTo) {
          return false;
        }
      } else {
        // 有効日がないメッセージは除外
        return false;
      }
    }

    return true;
  });
})

// 詳細検索実行
const executeDetailedSearch = () => {
  // console.log('詳細検索実行:', {
  //   keyword: searchKeyword.value,
  //   tags: searchTags.value,
  //   dateFrom: searchDateFrom.value,
  //   dateTo: searchDateTo.value,
  //   channel: searchChannel.value
  // })
  // ここで実際の検索処理を実装
  searchDialog.value = false
}

// 検索条件をリセット
const resetSearchForm = () => {
  searchKeyword.value = ""
  searchTags.value = []
  searchDateFrom.value = ""
  searchDateTo.value = ""
  searchChannel.value = ""
}

// 並び順に応じたリストを計算
const sortedChatList = computed(() => {
  return isNewestFirst.value ? [...chatList].reverse() : [...chatList]
})

// 並び順を切り替える
const toggleSortOrder = () => {
  isNewestFirst.value = !isNewestFirst.value
}

// チャンネルを切り替える
const switchChannel = (channelId) => {
  if (currentChannel.value !== channelId) {
    currentChannel.value = channelId
    // チャンネル切り替え時に最下部へスクロール
    scrollToBottom()
  }
}

// サイドバーの開閉を切り替える
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}
// #endregion

// #region lifecycle
onMounted(async () => {
  // ユーザー名を設定
  userName.value = UserService.getUserNameValue()
  
  await loadInitialMessages()
  registerSocketEvent()
})
// #endregion

// #region browser event handler

// タグを選択（develop版から継承）
const toggleTag = (tag) => {
  const index = selectedTags.value.indexOf(tag)
  if (index === -1) {
    selectedTags.value.push(tag)
  } else {
    selectedTags.value.splice(index, 1)
  }
}

// 検索用タグ選択
const toggleSearchTag = (tag) => {
  const index = selectedSearchTags.value.indexOf(tag)
  if (index === -1) {
    selectedSearchTags.value.push(tag)
  } else {
    selectedSearchTags.value.splice(index, 1)
  }
}

// 投稿メッセージをサーバに送信する（develop版のタグ機能を使用）
const onPublish = async () => {
  try {
    // 「すべて」チャンネルでは投稿不可
    if (currentChannel.value < 0) {
      alert('このチャンネルでは投稿できません。投稿するチャンネルを選択してください。')
      return
    }

    isUploading.value = true
    let imageUrl = null

    // 画像が選択されている場合はアップロード
    if (selectedImage.value) {
      imageUrl = await ImageService.uploadImage(selectedImage.value, userName.value)
    }

    const trimmedContent = inputText.value.trim()

    // バリデーション：トリム後が空の場合をチェック
    if (!trimmedContent || trimmedContent.length === 0) {
      if (!imageUrl) {
        return
      }
    }

    // 元の入力内容（空白含む）を送信
    if (trimmedContent || imageUrl) {
      // チャンネル別メッセージに追加
      const messageObj = {
        publisherName: userName.value,
        text: inputText.value,
        imageUrl: imageUrl,
        channelID: currentChannel.value, // 正の値のchannelIDのみ
        tags: selectedTags.value,
        expirationDate: expirationDate.value,
      }
      await ChatService.publish(messageObj)
      
      inputText.value = ""
      expirationDate.value = ""
      selectedTags.value = []
      resetFileInput()

      // テキストエリアのサイズをリセット
      if (messageTextarea.value) {
        messageTextarea.value.style.height = 'auto'
      }
      // ドロップダウンを閉じる
      closeAllDropdowns()
    }
  } catch (error) {
    console.error('投稿に失敗しました:', error)
    alert('投稿に失敗しました。もう一度お試しください。')
  } finally {
    isUploading.value = false
  }
}

// 退室処理
const onExit = async () => {
  try {

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
// サーバから受信した投稿メッセージを画面上に表示する（develop版）
const onReceivePublish = (data) => {
  try {
    const messageObj = {
      publisherName: data.publisherName,
      text: data.text || data.message,
      userID: data.userID,
      channelID: data.channelID,
      tags: data.tag || [],
      imageUrl: data.imageUrl || null,
      expirationDate: data.expirationDate || null,
      timestamp: data.timestamp
    }

    // 応急処置
    if (messageObj.timestamp == null) {
      messageObj.timestamp = {
        seconds: Math.floor(Date.now() / 1000),
        nanoseconds: 0,
      }
    }

    chatList.push(messageObj)
    scrollToBottom()
  } catch (error) {
    console.error('投稿メッセージ処理エラー:', error)
  }
}
// #endregion

// #region local methods
// 初期メッセージを取得してchatListに設定
const loadInitialMessages = async () => {
  try {
    const initialMessages = await ChatService.getInitialMessages()

    const convertedMessages = initialMessages.map(message => ({
      ...message,
      tags: message.tag || []  // tag → tags に変換
    }))

    chatList.push(...convertedMessages)
    scrollToBottom() // 初期読み込み時も最下部へスクロール
  } catch (error) {
    console.error('初期メッセージの読み込みに失敗しました:', error)
  }
}

// イベント登録をまとめる
const registerSocketEvent = () => {
  try {
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

// テキストエリアの自動リサイズ
const autoResizeTextarea = () => {
  if (messageTextarea.value) {
    messageTextarea.value.style.height = 'auto'
    const scrollHeight = messageTextarea.value.scrollHeight
    const maxHeight = 60 // 最大3行分（20px * 3）
    messageTextarea.value.style.height = Math.min(scrollHeight, maxHeight) + 'px'
  }
}

// メッセージエリアを最下部にスクロール
const scrollToBottom = () => {
  if (messagesArea.value) {
    setTimeout(() => {
      messagesArea.value.scrollTop = messagesArea.value.scrollHeight
    }, 100)
  }
}

// タグドロップダウンの開閉
const toggleTagDropdown = () => {
  showTagDropdown.value = !showTagDropdown.value
  if (showDatePicker.value) showDatePicker.value = false
}

// 日付ピッカーの開閉
const toggleDatePicker = () => {
  showDatePicker.value = !showDatePicker.value
  if (showTagDropdown.value) showTagDropdown.value = false
}

// 日付ピッカーを閉じる
const closeDatePicker = () => {
  showDatePicker.value = false
}

// 日付をクリア
const clearDate = () => {
  expirationDate.value = ""
  showDatePicker.value = false
}

// 全てのドロップダウンを閉じる
const closeAllDropdowns = () => {
  showTagDropdown.value = false
  showDatePicker.value = false
}

const formatTimestamp = (timestamp) => {
  if (timestamp && typeof timestamp.seconds === 'number') {
    const date = new Date(timestamp.seconds * 1000); // 秒をミリ秒に変換
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
  }
  return '不明な日時';
};
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
      <!-- 検索セクション -->
      <div class="search-section">
        <div class="search-row">
          <!-- タグボタン -->
          <button
            v-for="tag in availableTags"
            :key="tag"
            @click="toggleSearchTag(tag)"
            :class="{ 'selected': selectedSearchTags.includes(tag) }"
            class="tag-button"
            type="button"
          >
            {{ tag }}
          </button>
          
          <!-- 詳細検索ダイアログ -->
          <v-dialog v-model="searchDialog" max-width="600">
            <template v-slot:activator="{ props: activatorProps }">
              <v-btn
                v-bind="activatorProps"
                color="primary"
                variant="outlined"
                class="search-detail-btn"
                size="small"
                :class="{ 'active-search': searchDateFrom || searchDateTo }"
              >
                有効期間
              </v-btn>
            </template>

            <template v-slot:default="{ isActive }">
              <v-card title="有効期間">
                <v-card-text>
                  <!-- 期間選択 -->
                  <div class="date-range mb-3">
                    <v-text-field
                      v-model="searchDateFrom"
                      label="開始日"
                      type="date"
                      class="mr-2"
                    ></v-text-field>
                    <v-text-field
                      v-model="searchDateTo"
                      label="終了日"
                      type="date"
                    ></v-text-field>
                  </div>
                </v-card-text> 

                <v-card-actions>
                  <v-btn
                    text="リセット"
                    variant="outlined"
                    @click="resetSearchForm"
                  ></v-btn>
                  
                  <v-spacer></v-spacer>

                  <v-btn
                    text="キャンセル"
                    @click="isActive.value = false"
                  ></v-btn>
                  
                  <v-btn
                    text="検索"
                    color="primary"
                    @click="executeDetailedSearch"
                  ></v-btn>
                </v-card-actions>
              </v-card>
            </template>
          </v-dialog>
        </div>
      </div>

      <div class="chat-container">
        <!-- メッセージ表示エリア -->
        <div class="messages-area" ref="messagesArea">
          <div v-if="filteredChatList.length === 0" class="no-messages">
            <p>{{ getCurrentChannelInfo.icon }} # {{ getCurrentChannelInfo.name }} チャンネルにはまだメッセージがありません</p>
            <p v-if="currentChannel >= 0">最初のメッセージを投稿してみましょう！</p>
          </div>
          <ul v-else class="message-list">
            <li class="chat-item" v-for="(chat, i) in filteredChatList" :key="i">
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
                  <div v-if="chat.text" class="message-text chat-message-display">
                    {{ chat.text }}
                  </div>
                  <div v-if="chat.imageUrl" class="message-image">
                    <img :src="chat.imageUrl" alt="アップロード画像" class="uploaded-image" />
                  </div>
                  <!-- タグ表示 -->
                  <div v-if="chat.tags && chat.tags.length > 0" class="message-tags">
                    <span v-for="tag in chat.tags" :key="tag" class="tag-item">
                      {{ tag }}
                    </span>
                  </div>
                  <!-- メタデータ表示 -->
                  <div class="message-metadata">
                    <div class="message-timestamp">
                      {{ formatTimestamp(chat.timestamp) }}
                    </div>
                    <div v-if="chat.expirationDate" class="message-expiration">
                      有効日: {{ chat.expirationDate }}
                    </div>
                  </div>
                </div>
              </template>
            </li>
          </ul>
        </div>

        <!-- 入力エリア -->
        <div class="input-area">
          <!-- チャンネル投稿制限メッセージ -->
          <div v-if="currentChannel < 0" class="channel-restriction-message">
            💡 このチャンネルでは投稿できません。投稿するには具体的なチャンネル（引継ぎ、シフト、業務連絡）を選択してください。
          </div>

          <div class="input-container">
            <!-- メッセージ入力とボタン -->
            <div class="input-row">
              <div class="input-wrapper">
                <textarea 
                  :placeholder="currentChannel < 0 ? 'このチャンネルでは投稿できません' : `# ${getCurrentChannelInfo.name} に投稿...`" 
                  class="message-input" 
                  v-model="inputText"
                  :disabled="currentChannel < 0"
                  @keydown.enter="handleKeydownEnter"
                  @input="autoResizeTextarea"
                  ref="messageTextarea"
                  rows="1">
                </textarea>
                
                <!-- 投稿ボタン -->
                <button 
                  class="send-button" 
                  @click="onPublish" 
                  :disabled="isUploading || currentChannel < 0"
                  title="投稿 (Ctrl+Enter)">
                  {{ isUploading ? '⏳' : '📤' }}
                </button>
              </div>
            </div>

            <!-- 機能ボタン行 -->
            <div class="function-buttons">
              <!-- ファイル選択 -->
              <div class="function-button-group">
                <button 
                  class="function-button" 
                  @click="$refs.fileInput.click()" 
                  :disabled="currentChannel < 0"
                  title="ファイルを添付">
                  📎
                </button>
                <input 
                  ref="fileInput" 
                  type="file" 
                  accept="image/*" 
                  @change="onImageSelect" 
                  class="hidden-file-input" 
                  :disabled="currentChannel < 0" 
                />
                <span v-if="selectedImage" class="attachment-info">{{ selectedImage.name }}</span>
              </div>

              <!-- タグ選択 -->
              <div class="function-button-group" style="position: relative;">
                <button 
                  class="function-button" 
                  @click="toggleTagDropdown" 
                  :disabled="currentChannel < 0"
                  title="タグを選択">
                  🏷️
                </button>
                <span v-if="selectedTags.length > 0" class="tag-info">{{ selectedTags.join(', ') }}</span>
                
                <!-- タグドロップダウン -->
                <div v-if="showTagDropdown" class="tag-dropdown" @click.stop>
                  <div class="tag-dropdown-header">タグを選択</div>
                  <div class="tag-options">
                    <label 
                      v-for="tag in availableTags" 
                      :key="tag" 
                      class="tag-option">
                      <input 
                        type="checkbox" 
                        :value="tag" 
                        v-model="selectedTags"
                        class="tag-checkbox">
                      <span class="tag-label">{{ tag }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- 有効期間設定 -->
              <div class="function-button-group" style="position: relative;">
                <button 
                  class="function-button" 
                  @click="toggleDatePicker" 
                  :disabled="currentChannel < 0"
                  title="有効期間を設定">
                  📅
                </button>
                <span v-if="expirationDate" class="date-info">{{ expirationDate }}</span>
                
                <!-- 日付ピッカー -->
                <div v-if="showDatePicker" class="date-picker" @click.stop>
                  <div class="date-picker-header">
                    <span>有効期間設定</span>
                    <button class="close-button" @click="closeDatePicker">×</button>
                  </div>
                  <input 
                    type="date" 
                    v-model="expirationDate" 
                    class="date-input"
                    :min="new Date().toISOString().split('T')[0]" 
                  />
                  <div class="date-picker-actions">
                    <button class="clear-date-button" @click="clearDate">クリア</button>
                  </div>
                </div>
              </div>

              <!-- 退室ボタン -->
              <div class="function-button-group exit-group">
                <button class="exit-button" @click="onExit" title="退室する">
                  🚪 退室
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- オーバーレイ（ドロップダウン・ピッカーを閉じるため） -->
    <div 
      v-if="showTagDropdown || showDatePicker" 
      class="overlay" 
      @click="closeAllDropdowns">
    </div>
  </div>
</template>

<style scoped>
.chat-app {
  display: flex;
  height: 100vh;
  background-color: #f5f5f5;
  overflow: hidden;
}

.sidebar {
  width: 280px;
  background-color: #2c3e50;
  color: white;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-closed {
  width: 60px;
}

.sidebar-header {
  padding: 12px 16px;
  border-bottom: 1px solid #34495e;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
}

.sidebar-toggle {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
}

.user-info {
  padding: 12px 16px;
  border-bottom: 1px solid #34495e;
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #3498db;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
}

.channel-list {
  padding: 4px 0;
}

.channel-item {
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
}

.channel-item:hover {
  background-color: #34495e;
}

.channel-item.active {
  background-color: #3498db;
}

.channel-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.channel-info {
  flex: 1;
}

.channel-name {
  font-weight: 500;
  font-size: 13px;
}

.channel-desc {
  font-size: 11px;
  opacity: 0.8;
  margin-top: 1px;
}

.channel-indicator {
  width: 3px;
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
  min-width: 0;
}

.main-content-full {
  margin-left: 0;
}

.search-section {
  padding: 6px 12px;
  background-color: white;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-combobox {
  flex: 1;
  max-width: 300px;
}

.search-detail-btn {
  flex-shrink: 0;
  transition: background-color 0.3s, color 0.3s;
}

.search-detail-btn.active-search {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.date-range {
  display: flex;
  gap: 12px;
}

.date-range .v-text-field {
  flex: 1;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: white;
  min-height: 0;
  overflow: visible;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
  scroll-behavior: smooth;
}

.no-messages {
  text-align: center;
  color: #7f8c8d;
  padding: 20px;
}

.message-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.chat-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8px;
  padding: 4px 0;
}

.chat-publisher {
  flex-shrink: 0;
  margin-right: 8px;
  font-weight: bold;
  color: #2c3e50;
  font-size: 14px;
}

.chat-content {
  flex-grow: 1;
  min-width: 0;
}

.chat-message-display {
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  font-size: 14px;
  line-height: 1.4;
}

.message-container {
  flex-grow: 1;
  min-width: 0;
}

.message-header {
  font-weight: bold;
  margin-bottom: 2px;
  color: #2c3e50;
  font-size: 14px;
}

.message-text {
  margin-bottom: 4px;
  font-size: 14px;
  line-height: 1.4;
}

.message-image {
  margin-top: 4px;
}

.uploaded-image {
  max-width: 300px;
  max-height: 200px;
  border-radius: 6px;
  border: 1px solid #ddd;
}

.message-tags {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.tag-item {
  background-color: #e9ecef;
  color: #495057;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
  border: 1px solid #dee2e6;
}

.message-metadata {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #6c757d;
  margin-top: 4px;
}
.message-timestamp,
.message-expiration {
  font-style: italic;
}

.input-area {
  padding: 8px 16px 12px 16px;
  border-top: 1px solid #e0e0e0;
  background-color: #fafafa;
  flex-shrink: 0;
  overflow: visible;
}

.channel-restriction-message {
  margin-bottom: 8px;
  padding: 8px 12px;
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  color: #856404;
  font-size: 13px;
}

.input-container {
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 8px;
  overflow: visible;
}

.input-row {
  display: flex;
  align-items: flex-end;
}

.input-wrapper {
  display: flex;
  align-items: flex-end;
  flex: 1;
}

.message-input {
  flex: 1;
  border: none;
  outline: none;
  padding: 12px;
  font-size: 14px;
  resize: none;
  min-height: 20px;
  max-height: 60px;
  line-height: 1.4;
  font-family: inherit;
}

.message-input:disabled {
  background-color: #f5f5f5;
  color: #999;
}

.send-button {
  background: none;
  border: none;
  padding: 12px 16px;
  cursor: pointer;
  font-size: 18px;
  color: #3498db;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.send-button:hover:not(:disabled) {
  background-color: #f0f0f0;
}

.send-button:disabled {
  color: #ccc;
  cursor: not-allowed;
}

.function-buttons {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background-color: #f8f9fa;
  border-top: 1px solid #e9ecef;
  gap: 16px;
  flex-wrap: wrap;
}

.function-button-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.function-button {
  background: none;
  border: none;
  padding: 4px 6px;
  cursor: pointer;
  font-size: 16px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.function-button:hover:not(:disabled) {
  background-color: #e9ecef;
}

.function-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hidden-file-input {
  display: none;
}

.attachment-info, .tag-info, .date-info {
  font-size: 11px;
  color: #666;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exit-group {
  margin-left: auto;
}

.exit-button {
  background-color: #e74c3c;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
}

.exit-button:hover {
  background-color: #c0392b;
}

/* タグボタンのスタイル */
.tag-button {
  padding: 3px 7px;
  margin: 4px 0px;
  border: 1px solid #ccc;
  border-radius: 4px;
  /* background-color: #f8f9fa; */
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.tag-button:hover {
  background-color: #e9ecef;
}

.tag-button.selected {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

/* ドロップダウン・ピッカー */
.tag-dropdown, .date-picker {
  position: absolute;
  bottom: 100%;
  left: 0;
  background: white;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 2000;
  min-width: 180px;
  margin-bottom: 4px;
}

.tag-dropdown-header, .date-picker-header {
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  font-weight: 500;
  font-size: 13px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #666;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tag-options {
  padding: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.tag-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  cursor: pointer;
  font-size: 13px;
}

.tag-checkbox {
  margin: 0;
}

.tag-label {
  flex: 1;
}

.date-input {
  margin: 8px 12px;
  padding: 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
  width: calc(100% - 24px);
}

.date-picker-actions {
  padding: 8px 12px;
  border-top: 1px solid #eee;
  text-align: right;
}

.clear-date-button {
  background: none;
  border: 1px solid #ccc;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #666;
}

.clear-date-button:hover {
  background-color: #f0f0f0;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1999;
}

/* メッセージエリアを最下部にスクロール */
.messages-area::-webkit-scrollbar {
  width: 6px;
}

.messages-area::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.messages-area::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.messages-area::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>