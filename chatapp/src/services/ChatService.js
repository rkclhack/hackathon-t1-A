import { db } from '../firebase.js'
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp
} from 'firebase/firestore'
import AuthService from './AuthService.js'
import { transformVNodeArgs } from 'vue'

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
   * Firestoreのリスナーを初期化
   */
  initializeFirestoreListeners() {
    // メッセージコレクションを監視
    const messagesRef = collection(db, 'messages')
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'))
    
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data()
          
          // メッセージタイプに応じて適切なハンドラーを呼び出し

          if (data.type === 'message') {
            this.eventHandlers.publish.forEach(handler => handler({
              message: data.message,
              publisherName: data.publisherName,
              userID: data.userID,
              channelID: data.channelID,
              tag: data.tag || [],
              imageUrl: data.imageUrl || null
            }))
          }
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
        type: 'message',
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