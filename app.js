// ==========================================
// 1. 初始化 Supabase 帳戶連接資訊 (相容 CDN 全域變數)
// ==========================================
const SUPABASE_URL = 'https://uzusjdbhhfimynkncrxf.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_Rn8znWY2E2EHHZE9wVGM1A_hs1pg-Sb'; 

// 🌟 核心修正：如果 window.supabase.createClient 存在，就建立實例；否則直接沿用全域的 supabase
let supabaseInstance;
if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else if (window.supabase) {
    supabaseInstance = window.supabase;
} else {
    console.error("Supabase SDK 載入失敗，請檢查 HTML 是否正確引入 CDN！");
}

// 將我們後續要操作的 client 指向這個實例
const db = supabaseInstance;

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

// 防止 XSS 攻擊的安全過濾
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ==========================================
// 2. 主要渲染：同時撈取「貼文」與「留言」
// ==========================================
async function fetchPosts() {
    try {
        if (!db) return;

        // 撈取貼文
        const { data: posts, error: postError } = await db
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (postError) throw postError;

        // 撈取留言
        const { data: comments, error: commentError } = await db
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

            // 過濾屬於該貼文的留言
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

        // 綁定留言回覆點擊事件
        document.querySelectorAll('.comment-submit-btn').forEach(button => {
            button.addEventListener('click', async function(e) {
                e.preventDefault();
                const targetPostId = this.getAttribute('data-postid');
                await submitComment(targetPostId);
            });
        });

    } catch (error) {
        console.error(error);
        if (statusMessage) statusMessage.innerHTML = `❌ 連線失敗: ${error.message}`;
    }
}

// ==========================================
// 3. 處理「按讚 / 收回讚」
// ==========================================
window.handleLikeClick = async function(postId, currentLikes) {
    if (!db) return;
    const likedPosts = getLikedPosts();
    const isAlreadyLiked = likedPosts.includes(postId);
    const newLikesCount = isAlreadyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

    toggleLocalLike(postId);
    fetchPosts(); 

    try {
        const { error } = await db.from('posts').update({ likes: newLikesCount }).eq('id', postId);
        if (error) throw error;
    } catch (error) {
        console.error("按讚失敗:", error);
        toggleLocalLike(postId);
        fetchPosts();
    }
};

// ==========================================
// 4. 處理「發布新貼文」
// ==========================================
if (postForm) {
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!db) return;
        
        const title = document.getElementById('postTitle').value.trim();
        const content = document.getElementById('postContent').value.trim();
        const submitBtn = document.getElementById('submitBtn');

        if (!title || !content) return;
        submitBtn.disabled = true;

        try {
            const { error } = await db.from('posts').insert([{ title, content, likes: 0 }]);
            if (error) throw error;
            postForm.reset();
            await fetchPosts();
        } catch (error) {
            console.error(error);
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
    if (!db) return;
    const inputElement = document.getElementById(`input-${postId}`);
    if (!inputElement) return;
    
    const content = inputElement.value.trim();

    if (!content) {
        alert('回覆內容不能留空喔！');
        return;
    }

    try {
        const { error } = await db
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

// 頁面加載完成後自動初始化
if (postsContainer) {
    fetchPosts();
}