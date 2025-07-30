import socketManager from '../socketManager.js'

/**
 * チャット通信を担うサービスクラス
 * バックエンドの実装詳細（Socket.io）を隠蔽し、
 * 将来Firebase Storeなどに切り替える際の影響を最小限にする
 */
class ChatService {
  constructor() {
    this.socket = socketManager.getInstance()
    this.eventHandlers = {
      enter: [],
      exit: [],
      publish: []
    }
    this.initializeSocketListeners()
  }

  /**
   * Socket.ioのイベントリスナーを初期化
   */
  initializeSocketListeners() {
    this.socket.on("enterEvent", (data) => {
      this.eventHandlers.enter.forEach(handler => handler(data))
    })

    this.socket.on("exitEvent", (data) => {
      this.eventHandlers.exit.forEach(handler => handler(data))
    })

    this.socket.on("publishEvent", (data) => {
      this.eventHandlers.publish.forEach(handler => handler(data))
    })
  }

  /**
   * 入室処理
   * @param {string} userName - ユーザー名
   */
  enter(userName) {
    this.socket.emit("enterEvent", userName)
  }

  /**
   * 退室処理
   * @param {string} userName - ユーザー名
   */
  exit(userName) {
    this.socket.emit("exitEvent", userName)
  }

  /**
   * メッセージ投稿処理
   * @param {string} message - メッセージ内容
   * @param {string} publisherName - 投稿者名
   */
  publish(message, publisherName) {
    this.socket.emit("publishEvent", { message, publisherName })
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
}

export default new ChatService() 