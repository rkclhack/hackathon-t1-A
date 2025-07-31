import { db } from '../firebase.js'
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  where
} from 'firebase/firestore'
import AuthService from './AuthService.js'

/**
 * チャット通信を担うサービスクラス
 * Firestoreを使用してリアルタイムチャット機能を提供
 * Socket.ioと同じAPIインターフェースを維持して、既存コンポーネントとの互換性を保つ
 */
class ChatService {
  constructor() {
    this.eventHandlers = {
      publish: []
    }
    this.unsubscribers = []
    this.initializeFirestoreListeners()
  }

  /**
   * 初期メッセージを取得
   * @returns {Promise<Array>} メッセージ配列
   */
  async getInitialMessages() {
    try {
      const messagesRef = collection(db, 'messages')
      const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'))
      const snapshot = await getDocs(messagesQuery)

      const messages = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        messages.push({
          id: doc.id,
          message: data.message,
          publisherName: data.publisherName,
          userID: data.userID,
          channelID: data.channelID,
          tag: data.tag || [],
          imageUrl: data.imageUrl || null,
          timestamp: data.timestamp
        })
      })

      return messages
    } catch (error) {
      console.error('初期メッセージ取得でエラーが発生しました:', error)
      return []
    }
  }

  /**
   * Firestoreのリスナーを初期化（差分更新のみを監視）
   */
  initializeFirestoreListeners() {
    // メッセージコレクションを監視
    const messagesRef = collection(db, 'messages')
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'))

    let isInitialLoad = true

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      // 初回ロードの場合はスキップ（getInitialMessages()で処理済み）
      if (isInitialLoad) {
        isInitialLoad = false
        return
      }

      // 差分のみを処理
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data()

          this.eventHandlers.publish.forEach(handler => handler({
            id: change.doc.id,
            message: data.message,
            publisherName: data.publisherName,
            userID: data.userID,
            channelID: data.channelID,
            tag: data.tag || [],
            imageUrl: data.imageUrl || null,
            timestamp: data.timestamp
          }))
        }
      })
    })

    this.unsubscribers.push(unsubscribeMessages)
  }



  /**
   * メッセージ投稿処理
   * @param {string} message - メッセージ内容
   * @param {string} publisherName - 投稿者名
   * @param {string|null} imageUrl - 画像のURL（オプション）
   */
  async publish(message, publisherName, imageUrl = null, tags = [], channelID = 0) {
    try {
      // AuthServiceからユーザーIDを取得
      const currentUser = AuthService.getCurrentUser()
      const userID = currentUser ? currentUser.uid : null

      const messageData = {
        message: message,
        publisherName: publisherName,
        userID: userID,
        channelID: channelID,
        tag: tags,
        timestamp: serverTimestamp()
      }

      // 画像URLがある場合は追加
      if (imageUrl) {
        messageData.imageUrl = imageUrl
      }

      await addDoc(collection(db, 'messages'), messageData)
    } catch (error) {
      console.error('メッセージ投稿でエラーが発生しました:', error)
    }
  }



  /**
   * タグをもとにメッセージを検索
   * @param {string} condition - 検索条件 "and" または "or"
   * @param {string[]} tags - 検索するタグ配列
   * @returns {Promise<Array>} 検索条件に一致するメッセージ配列
   */
  async searchMessagesByTags(condition = 'and', tags = []) {
    try {

      if (!tags || tags.length === 0) {
        return []
      }

      const messagesRef = collection(db, 'messages')
      let messagesQuery

      if (condition === 'or') {
        //指定されたタグのいずれかを含むメッセージを取得
        messagesQuery = query(
          messagesRef,
          where('tag', 'array-contains-any', tags),
          orderBy('timestamp', 'desc')
        )
      } else if (condition === 'and') {
        // AND検索：Firestoreの制限により、複数のarray-containsは使用できないため
        // まずは全メッセージを取得してクライアント側でフィルタリング
        messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'))
      } else {
        throw new Error('無効な検索条件です。"and" または "or" を指定してください。')
      }

      const snapshot = await getDocs(messagesQuery)
      const messages = []

      snapshot.forEach((doc) => {
        const data = doc.data()
        const messageData = {
          id: doc.id,
          message: data.message,
          publisherName: data.publisherName,
          userID: data.userID,
          channelID: data.channelID,
          tag: data.tag || [],
          imageUrl: data.imageUrl || null,
          timestamp: data.timestamp
        }

        // AND検索の場合、クライアント側ですべてのタグが含まれているかチェック
        if (condition === 'and') {
          const hasAllTags = tags.every(tag => data.tag && data.tag.includes(tag))
          if (hasAllTags) {
            messages.push(messageData)
          }
        } else {
          // OR検索の場合はFirestoreクエリで既にフィルタされているのでそのまま追加
          messages.push(messageData)
        }
      })

      return messages
    } catch (error) {
      console.error('タグ検索でエラーが発生しました:', error)
      return []
    }
  }

  /**
   * 投稿イベントのハンドラーを登録
   * @param {Function} handler - コールバック関数
   */
  onPublish(handler) {
    this.eventHandlers.publish.push(handler)
  }

  /**
   * リスナーのクリーンアップ
   */
  cleanup() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe())
    this.unsubscribers = []
    this.eventHandlers = {
      publish: []
    }
  }
}

export default new ChatService() 