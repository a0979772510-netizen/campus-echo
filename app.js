// ==========================================
// 1. 初始化連線實例
// ==========================================
const SUPABASE_URL = 'https://uzusjobhfiznykncrfxf.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_Rn8znWY2E2EHHZE9wVGM1A_hs1pg-Sb'; 

let supabaseClient;

try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error("找不到 Supabase SDK 的 createClient 方法！");
    }
} catch (err) {
    console.error("初始化 Supabase 發生異常:", err);
}

const postForm = document.getElementById('postForm');
const postsContainer = document.getElementById('postsContainer');
const statusMessage = document.getElementById('statusMessage');

// 按讚本地儲存管理
function getLikedPosts() {
    const liked = localStorage.getItem('likedPosts');
    return liked ? JSON.parse(liked) : [];
}

function toggleLocalLike(postId) {
    let liked = getLikedPosts();
    // 確保轉成字串比對，相容數字與 UUID
    const idStr = String(postId);
    if (liked.includes(idStr)) {
        liked = liked.filter(id => id !== idStr);
    } else {
        liked.push(idStr);
    }
    localStorage.setItem('likedPosts', JSON.stringify(liked));
}

// 防止 XSS 攻擊
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ==========================================
// 2. 撈取「貼文」與「留言」並渲染畫面
// ==========================================
async function fetchPosts() {
    try {
        if (!supabaseClient) return;

        // 撈取貼文
        const { data: posts, error: postError } = await supabaseClient
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (postError) throw postError;

        // 撈取留言 (若無留言表則回傳空陣列，避免整支程式卡死)
        let comments = [];
        try {
            const { data: commentsData, error: commentError } = await supabaseClient
                .from('comments')
                .select('*')
                .order('created_at', { ascending: true });
            if (!commentError) comments = commentsData;
        } catch (ce) {
            console.warn("留言撈取失敗，可能 comments 表格尚未建立或 RLS 限制:", ce);
        }

        if (statusMessage) statusMessage.style.display = 'none';
        postsContainer.innerHTML = '';

        if (!posts || posts.length === 0) {
            postsContainer.innerHTML = '<p class="no-posts">目前廣場空空如也！</p>';
            return;
        }

        const likedPosts = getLikedPosts();

        posts.forEach(post => {
            const formattedTime = new Date(post.created_at).toLocaleString('zh-TW', {
                month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
            });

            // 轉字串比對按讚狀態
            const isLiked = likedPosts.includes(String(post.id));
            const heartClass = isLiked ? 'heart-btn liked' : 'heart-btn';

            // 確保 post_id 與 post.id 型態一致再進行過濾
            const postComments = comments ? comments.filter(c => String(c.post_id) === String(post.id)) : [];
            let commentsHtml = '';
            
            postComments.forEach((c, index) => {
                commentsHtml += `
                    <div class="comment-item">
                        <span class="comment-user">B${index + 1}：</span>
                        <span class="comment-text">${escapeHtml(c.content)}</span>
                    </div>
                `;
            });

            const card = document.createElement('div');
            card.className = 'post-card';
            card.innerHTML = `
                <div class="post-header">
                    <span class="post-avatar">👤 匿名同學</span>
                    <span class="post-time">${formattedTime}</span>
                </div>
                <h4 class="post-card-title">${escapeHtml(post.title)}</h4>
                <p class="post-card-content">${escapeHtml(post.content)}</p>
                
                <div class="post-actions">
                    <button class="${heartClass}" onclick="handleLikeClick('${post.id}', ${post.likes || 0})">
                        ❤ <span>讚 ${post.likes || 0}</span>
                    </button>
                </div>

                <div class="comments-section">
                    <div class="comments-list">${commentsHtml}</div>
                    <div class="comment-form-group">
                        <input type="text" id="input-${post.id}" placeholder="寫下你的匿名回覆..." class="comment-input">
                        <button type="button" data-postid="${post.id}" class="comment-submit-btn">回覆</button>
                    </div>
                </div>
            `;
            postsContainer.appendChild(card);
        });

        // 綁定留言按鈕點擊
        document.querySelectorAll('.comment-submit-btn').forEach(button => {
            button.addEventListener('click', async function(e) {
                e.preventDefault();
                const targetPostId = this.getAttribute('data-postid');
                await submitComment(targetPostId);
            });
        });

    } catch (error) {
        console.error("資料渲染失敗:", error);
        if (statusMessage) statusMessage.innerHTML = `❌ 連線失敗: ${error.message}`;
    }
}

// ==========================================
// 3. 處理「按讚 / 收回讚」
// ==========================================
window.handleLikeClick = async function(postId, currentLikes) {
    if (!supabaseClient) return;
    const likedPosts = getLikedPosts();
    const isAlreadyLiked = likedPosts.includes(String(postId));
    const newLikesCount = isAlreadyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

    toggleLocalLike(postId);
    fetchPosts(); 

    try {
        // 同時試圖更新 likes 欄位，若失敗則在控制台記錄，但不卡死網頁
        const { error } = await supabaseClient.from('posts').update({ likes: newLikesCount }).eq('id', postId);
        if (error) console.warn("資料庫 likes 欄位更新略過或失敗，請檢查後台欄位名稱是否為全小寫 likes");
    } catch (error) {
        console.error("按讚同步失敗:", error);
    }
};

// ==========================================
// 4. 處理「發布新貼文」
// ==========================================
if (postForm) {
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!supabaseClient) return;
        
        const title = document.getElementById('postTitle').value.trim();
        const content = document.getElementById('postContent').value.trim();
        const submitBtn = document.getElementById('submitBtn');

        if (!title || !content) return;
        submitBtn.disabled = true;

        try {
            // 嘗試寫入新貼文
            const { error } = await supabaseClient.from('posts').insert([{ title, content }]);
            if (error) throw error;
            postForm.reset();
            await fetchPosts();
        } catch (error) {
            console.error("發文失敗:", error);
            alert('發文失敗，請檢查資料庫欄位配置！');
        } finally {
            submitBtn.disabled = false;
        }
    });
}

// ==========================================
// 5. 處理「發布新留言」
// ==========================================
async function submitComment(postId) {
    if (!supabaseClient) return;
    const inputElement = document.getElementById(`input-${postId}`);
    if (!inputElement) return;
    
    const content = inputElement.value.trim();
    if (!content) {
        alert('回覆內容不能留空喔！');
        return;
    }

    try {
        // 🌟 自動偵測並轉換 post_id 的型態 (如果是純數字就轉數字，否則維持字串 UUID)
        const parsedPostId = !isNaN(postId) ? parseInt(postId, 10) : postId;

        const { error } = await supabaseClient
            .from('comments')
            .insert([{ post_id: parsedPostId, content: content }]);

        if (error) throw error;
        
        inputElement.value = ''; 
        await fetchPosts();      
    } catch (error) {
        alert('留言失敗，請確認 comments 表的 post_id 欄位型態與貼文 id 一致！');
        console.error("留言詳細錯誤:", error);
    }
}

// 初始化
if (postsContainer) {
    fetchPosts();
}