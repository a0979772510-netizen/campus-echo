// ==========================================
// 1. 初始化連線實例 (改名為 supabaseClient 徹底避開 CDN 全域命名衝突)
// ==========================================
const SUPABASE_URL = 'https://uzusjobhfiznykncrfxf.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_Rn8znWY2E2EHHZE9wVGM1A_hs1pg-Sb'; 

// 🌟 這裡改成 supabaseClient，確保絕不與 window.supabase 撞名
let supabaseClient;

try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error("找不到 Supabase SDK 的 createClient 方法！");
    }
} catch (err) {
    console.error("初始化 Supabase 時發生錯誤:", err);
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
    if (liked.includes(postId)) {
        liked = liked.filter(id => id !== postId);
    } else {
        liked.push(postId);
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
        if (!supabaseClient) {
            console.error("Supabase 連線未建立，無法撈取資料。");
            return;
        }

        // 1. 撈取貼文
        const { data: posts, error: postError } = await supabaseClient
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (postError) throw postError;

        // 2. 撈取留言
        const { data: comments, error: commentError } = await supabaseClient
            .from('comments')
            .select('*')
            .order('created_at', { ascending: true });

        if (commentError) throw commentError;

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

            const isLiked = likedPosts.includes(post.id);
            const heartClass = isLiked ? 'heart-btn liked' : 'heart-btn';

            // 過濾屬於當前貼文的留言
            const postComments = comments ? comments.filter(c => c.post_id === post.id) : [];
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

        // 動態綁定留言按鈕點擊事件，傳入正確的 uuid
        document.querySelectorAll('.comment-submit-btn').forEach(button => {
            button.addEventListener('click', async function(e) {
                e.preventDefault();
                const targetPostId = this.getAttribute('data-postid');
                await submitComment(targetPostId);
            });
        });

    } catch (error) {
        console.error("撈取資料失敗:", error);
        if (statusMessage) statusMessage.innerHTML = `❌ 連線失敗: ${error.message}`;
    }
}

// ==========================================
// 3. 處理「按讚 / 收回讚」
// ==========================================
window.handleLikeClick = async function(postId, currentLikes) {
    if (!supabaseClient) return;
    const likedPosts = getLikedPosts();
    const isAlreadyLiked = likedPosts.includes(postId);
    const newLikesCount = isAlreadyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

    toggleLocalLike(postId);
    fetchPosts(); 

    try {
        const { error } = await supabaseClient.from('posts').update({ likes: newLikesCount }).eq('id', postId);
        if (error) throw error;
    } catch (error) {
        console.error("按讚更新失敗:", error);
        toggleLocalLike(postId); // 失敗則回滾狀態
        fetchPosts();
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
            const { error } = await supabaseClient.from('posts').insert([{ title, content, likes: 0 }]);
            if (error) throw error;
            postForm.reset();
            await fetchPosts();
        } catch (error) {
            console.error("發文失敗:", error);
            alert('發文失敗！');
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
        const { error } = await supabaseClient
            .from('comments')
            .insert([{ post_id: postId, content: content }]);

        if (error) throw error;
        
        inputElement.value = ''; 
        await fetchPosts();      
    } catch (error) {
        alert('留言失敗，請確認 Supabase Table 與 RLS 開啟！');
        console.error("留言詳細錯誤資訊:", error);
    }
}

// 頁面載入完成後自動初始化
if (postsContainer) {
    fetchPosts();
}