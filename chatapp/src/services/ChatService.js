import { db } from '../firebase.js'
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore'

/**
 * チャット通信を担うサービスクラス
 * Firestoreを使用してリアルタイムチャット機能を提供
 * Socket.ioと同じAPIインターフェースを維持して、既存コンポーネントとの互換性を保つ
 */
class ChatService {
  constructor() {
    this.eventHandlers = {
      enter: [],
      exit: [],
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
          switch (data.type) {
            case 'enter':
              this.eventHandlers.enter.forEach(handler => handler(data.userName))
              break
            case 'exit':
              this.eventHandlers.exit.forEach(handler => handler(data.userName))
              break
            case 'message':
              this.eventHandlers.publish.forEach(handler => handler({
                message: data.message,
                publisherName: data.publisherName
              }))
              break
          }
        }
      })
    })
    
    this.unsubscribers.push(unsubscribeMessages)
  }

  /**
   * 入室処理
   * @param {string} userName - ユーザー名
   */
  async enter(userName) {
    try {
      // 入室メッセージをFirestoreに追加
      await addDoc(collection(db, 'messages'), {
        type: 'enter',
        userName: userName,
        timestamp: serverTimestamp()
      })
      
      // アクティブユーザーリストに追加
      await setDoc(doc(db, 'activeUsers', userName), {
        userName: userName,
        joinedAt: serverTimestamp()
      })
    } catch (error) {
      console.error('入室処理でエラーが発生しました:', error)
    }
  }

  /**
   * 退室処理
   * @param {string} userName - ユーザー名
   */
  async exit(userName) {
    try {
      // 退室メッセージをFirestoreに追加
      await addDoc(collection(db, 'messages'), {
        type: 'exit',
        userName: userName,
        timestamp: serverTimestamp()
      })
      
      // アクティブユーザーリストから削除
      await deleteDoc(doc(db, 'activeUsers', userName))
    } catch (error) {
      console.error('退室処理でエラーが発生しました:', error)
    }
  }

  /**
   * メッセージ投稿処理
   * @param {string} message - メッセージ内容
   * @param {string} publisherName - 投稿者名
   */
  async publish(message, publisherName) {
    try {
      await addDoc(collection(db, 'messages'), {
        type: 'message',
        message: message,
        publisherName: publisherName,
        timestamp: serverTimestamp()
      })
    } catch (error) {
      console.error('メッセージ投稿でエラーが発生しました:', error)
    }
  }

  /**
   * 入室イベントのハンドラーを登録
   * @param {Function} handler - コールバック関数
   */
  onEnter(handler) {
    this.eventHandlers.enter.push(handler)
  }

  /**
   * 退室イベントのハンドラーを登録
   * @param {Function} handler - コールバック関数
   */
  onExit(handler) {
    this.eventHandlers.exit.push(handler)
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
      enter: [],
      exit: [],
      publish: []
    }
  }
}

export default new ChatService() 