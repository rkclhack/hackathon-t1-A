import { ref } from 'vue'
import AuthService from './AuthService.js'

/**
 * ユーザー情報と認証状態を管理するサービスクラス
 * Vueコンポーネントから認証関連の処理を切り離し、再利用可能にする
 */
class UserService {
    constructor() {
        this.userName = ref("")
        this.authUnsubscribers = new Set()
        this.isInitialized = false

        // 初期化
        this.initialize()
    }

    /**
     * サービスの初期化
     */
    initialize() {
        if (this.isInitialized) return

        // 現在のユーザー名を設定
        this.updateUserName()

        // 認証状態の変化を監視
        const unsubscriber = AuthService.onAuthStateChange((user) => {
            this.updateUserName()
        })

        this.authUnsubscribers.add(unsubscriber)
        this.isInitialized = true
    }

    /**
     * ユーザー名を更新
     */
    updateUserName() {
        this.userName.value = AuthService.getUserName() || ""
    }

    /**
     * リアクティブなユーザー名を取得
     */
    getUserName() {
        return this.userName
    }

    /**
     * 現在のユーザー名の値を取得
     */
    getUserNameValue() {
        return this.userName.value
    }

    /**
     * コンポーネント専用の認証状態監視を追加
     * @param {Function} callback - 認証状態変化時のコールバック
     * @returns {Function} アンサブスクライブ関数
     */
    addAuthStateListener(callback) {
        const unsubscriber = AuthService.onAuthStateChange(callback)
        this.authUnsubscribers.add(unsubscriber)
        return unsubscriber
    }

    /**
     * 特定のリスナーを削除
     * @param {Function} unsubscriber - アンサブスクライブ関数
     */
    removeAuthStateListener(unsubscriber) {
        if (unsubscriber && this.authUnsubscribers.has(unsubscriber)) {
            unsubscriber()
            this.authUnsubscribers.delete(unsubscriber)
        }
    }

    /**
     * すべてのリスナーをクリーンアップ
     */
    cleanup() {
        this.authUnsubscribers.forEach(unsubscriber => {
            if (typeof unsubscriber === 'function') {
                unsubscriber()
            }
        })
        this.authUnsubscribers.clear()
        this.isInitialized = false
    }

    /**
     * ユーザーがログイン済みかチェック
     */
    isAuthenticated() {
        return AuthService.isAuthenticated()
    }

    /**
     * 現在のユーザー情報を取得
     */
    getCurrentUser() {
        return AuthService.getCurrentUser()
    }
}

// シングルトンとしてエクスポート
export default new UserService()