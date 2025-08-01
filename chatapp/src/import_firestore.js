import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Modulesでの__dirnameの取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase Admin SDK の初期化
const serviceAccountPath = path.join(__dirname, '..', 'rakus-tech-lab-t1-a-firebase-adminsdk-fbsvc-87037d9c6f.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * デモデータをFirestoreにインポートする関数
 */
async function importDemoData() {
    try {
        console.log('🚀 デモデータのインポートを開始します...');

        // メッセージデータのインポート
        await importMessages();

        // ユーザーデータのインポート
        await importUsers();

        console.log('🎉 すべてのデモデータのインポートが完了しました！');

    } catch (error) {
        console.error('❌ インポート中にエラーが発生しました:', error);
        process.exit(1);
    } finally {
        // Admin SDKの接続を終了
        admin.app().delete();
    }
}

/**
 * メッセージデータをインポートする関数
 */
async function importMessages() {
    console.log('\n📨 メッセージデータのインポートを開始...');

    // JSONファイルからデータを読み込み
    const dataPath = path.join(__dirname, '..', 'data', 'demo_messages.json');
    const jsonData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    const messages = jsonData.messages;
    const messageIds = Object.keys(messages);

    console.log(`📄 ${messageIds.length}件のメッセージをインポートします...`);

    // 既存データの削除確認
    const existingMessages = await db.collection('messages').get();
    if (!existingMessages.empty) {
        console.log(`⚠️  既存のメッセージ ${existingMessages.size}件が見つかりました。`);
        console.log('既存データを削除してから新しいデータをインポートします...');

        // 既存データを削除
        const batch = db.batch();
        existingMessages.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log('✅ 既存メッセージデータを削除しました。');
    }

    // 新しいデータをバッチでインポート
    const batch = db.batch();

    for (const messageId of messageIds) {
        const messageData = messages[messageId];
        const docRef = db.collection('messages').doc(messageId);

        // timestampを適切な形式に変換
        if (messageData.timestamp && messageData.timestamp.seconds) {
            messageData.timestamp = admin.firestore.Timestamp.fromMillis(
                messageData.timestamp.seconds * 1000 + Math.floor(messageData.timestamp.nanoseconds / 1000000)
            );
        }

        batch.set(docRef, messageData);
        console.log(`📝 メッセージ「${messageData.text.substring(0, 30)}...」を追加`);
    }

    await batch.commit();

    console.log('✅ メッセージデータのインポートが完了しました！');
    console.log(`📊 インポートされたメッセージ数: ${messageIds.length}件`);

    // チャンネル別の統計情報を表示
    const channelStats = {};
    messageIds.forEach(id => {
        const channelId = messages[id].channelID;
        const channelName = getChannelName(channelId);
        channelStats[channelName] = (channelStats[channelName] || 0) + 1;
    });

    console.log('📈 チャンネル別メッセージ数:');
    Object.entries(channelStats).forEach(([channel, count]) => {
        console.log(`   ${channel}: ${count}件`);
    });
}

/**
 * ユーザーデータをインポートする関数
 */
async function importUsers() {
    console.log('\n👥 ユーザーデータのインポートを開始...');

    // JSONファイルからデータを読み込み
    const dataPath = path.join(__dirname, '..', 'data', 'demo_users.json');
    const jsonData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    const users = jsonData.users;
    const userIds = Object.keys(users);

    console.log(`👤 ${userIds.length}件のユーザーをインポートします...`);

    // 既存データの削除確認
    const existingUsers = await db.collection('users').get();
    if (!existingUsers.empty) {
        console.log(`⚠️  既存のユーザー ${existingUsers.size}件が見つかりました。`);
        console.log('既存データを削除してから新しいデータをインポートします...');

        // 既存データを削除
        const batch = db.batch();
        existingUsers.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log('✅ 既存ユーザーデータを削除しました。');
    }

    // 新しいデータをバッチでインポート
    const batch = db.batch();

    for (const userId of userIds) {
        const userData = users[userId];
        const docRef = db.collection('users').doc(userId);

        // timestampを適切な形式に変換
        if (userData.createdAt && userData.createdAt.seconds) {
            userData.createdAt = admin.firestore.Timestamp.fromMillis(
                userData.createdAt.seconds * 1000 + Math.floor(userData.createdAt.nanoseconds / 1000000)
            );
        }

        if (userData.lastLoginAt && userData.lastLoginAt.seconds) {
            userData.lastLoginAt = admin.firestore.Timestamp.fromMillis(
                userData.lastLoginAt.seconds * 1000 + Math.floor(userData.lastLoginAt.nanoseconds / 1000000)
            );
        }

        batch.set(docRef, userData);
        console.log(`👤 ユーザー「${userData.name}（${userData.role}）」を追加`);
    }

    await batch.commit();

    console.log('✅ ユーザーデータのインポートが完了しました！');
    console.log(`📊 インポートされたユーザー数: ${userIds.length}件`);

    // 役職別の統計情報を表示
    const roleStats = {};
    userIds.forEach(id => {
        const role = users[id].role;
        roleStats[role] = (roleStats[role] || 0) + 1;
    });

    console.log('📈 役職別ユーザー数:');
    Object.entries(roleStats).forEach(([role, count]) => {
        console.log(`   ${role}: ${count}件`);
    });

    // 科目別の統計情報を表示
    const subjectStats = {};
    userIds.forEach(id => {
        const subjects = users[id].subjects || [];
        subjects.forEach(subject => {
            subjectStats[subject] = (subjectStats[subject] || 0) + 1;
        });
    });

    console.log('📈 担当科目別ユーザー数:');
    Object.entries(subjectStats).forEach(([subject, count]) => {
        console.log(`   ${subject}: ${count}件`);
    });
}

/**
 * チャンネルIDから名前を取得する補助関数
 */
function getChannelName(channelId) {
    const channelMap = {
        0: '引継ぎ',
        1: 'シフト',
        2: '業務連絡'
    };
    return channelMap[channelId] || `チャンネル${channelId}`;
}

// メイン処理の実行
if (import.meta.url === `file://${process.argv[1]}`) {
    importDemoData();
}