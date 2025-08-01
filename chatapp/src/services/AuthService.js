import { auth, googleProvider, db } from '../firebase.js'
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth'
import { 
  collection, 
  addDoc,
  doc,
  setDoc,
  getDoc 
} from 'firebase/firestore'

/**
 * Firebase Authentication を管理するサービスクラス
 * Google認証を提供し、ユーザーの認証状態を管理する
 */
class AuthService {
  constructor() {
    this.currentUser = null
    this.authStateListeners = []
    
    // 認証状態の変化を監視
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user
      this.authStateListeners.forEach(listener => listener(user))
    })
  }

  /**
   * Google認証でサインイン
   */
  async signInWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      
      // ユーザードキュメントの参照を作成
      const userDocRef = doc(db, 'users', result.user.uid)
      const userDoc = await getDoc(userDocRef)
      
      if (userDoc.exists()) {
        // 既存ユーザーの場合、最終ログイン時刻のみ更新
        await setDoc(userDocRef, {
          lastLoginAt: new Date()
        }, { merge: true })
      } else {
        // 新規ユーザーの場合、完全なユーザーデータを作成
        const userData = {
          uid: result.user.uid,
          name: result.user.displayName,
          createdAt: new Date(),
          lastLoginAt: new Date()
        }
        await setDoc(userDocRef, userData)
      }
      
      return result.user
    } catch (error) {
      console.error('Google認証エラー:', error)
      throw error
    }
  }

  /**
   * サインアウト
   */
  async signOut() {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('サインアウトエラー:', error)
      throw error
    }
  }

  /**
   * 現在のユーザーを取得
   */
  getCurrentUser() {
    return this.currentUser
  }

  /**
   * ユーザーがログインしているかチェック
   */
  isAuthenticated() {
    return this.currentUser !== null
  }

  /**
   * 認証状態の変化をリスナーに登録
   */
  onAuthStateChange(listener) {
    this.authStateListeners.push(listener)
    return () => {
      const index = this.authStateListeners.indexOf(listener)
      if (index > -1) {
        this.authStateListeners.splice(index, 1)
      }
    }
  }

  /**
   * ユーザー名を取得（表示名またはメールアドレスから）
   */
  getUserName() {
    if (!this.currentUser) return null
    return this.currentUser.displayName || this.currentUser.email.split('@')[0]
  }
}

export default new AuthService() 