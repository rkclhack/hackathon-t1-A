import { storage } from '../firebase.js'
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage'

/**
 * 画像アップロードを担うサービスクラス
 * Firebase Storageを使用して画像のアップロード・URL取得機能を提供
 */
class ImageService {
  /**
   * 画像ファイルをFirebase Storageにアップロードし、ダウンロードURLを取得
   * @param {File} file - アップロードする画像ファイル
   * @param {string} userName - アップロードするユーザー名
   * @returns {Promise<string>} - アップロード後の画像のダウンロードURL
   */
  async uploadImage(file, userName) {
    try {
      // ファイル名を生成（ユーザー名_タイムスタンプ_ファイル名）
      const timestamp = new Date().getTime()
      const fileName = `${userName}_${timestamp}_${file.name}`
      
      // Firebase Storageの参照を作成
      const imageRef = ref(storage, `chat-images/${fileName}`)
      
      // ファイルをアップロード
      const snapshot = await uploadBytes(imageRef, file)
      
      // ダウンロードURLを取得
      const downloadURL = await getDownloadURL(snapshot.ref)
      
      return downloadURL
    } catch (error) {
      console.error('画像のアップロードに失敗しました:', error)
      throw new Error('画像のアップロードに失敗しました')
    }
  }

}

export default new ImageService()