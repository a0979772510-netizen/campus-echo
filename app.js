// ==========================================
// 1. 初始化 Supabase 帳戶連接資訊
// ==========================================
const SUPABASE_URL = 'https://uzusjdbhhfimynkncrxf.supabase.co'; 
const SUPABASE_ANON_KEY = 'sbp_publishable_RndzWlY2E2EHH1NWRM3A_hsIpg-SO'; // 填入你原本長長的那串 anon key

// 確保全域只宣告一次 supabase 物件，防止 Identifier has already been declared 報錯
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

if (!supabase) {
    console.error("Supabase SDK 載入失敗，請檢查 forum.html 是否有引入 CDN！");
}

const postForm = document.getElementById('postForm');
const postsContainer = document.getElementById('postsContainer');
const statusMessage = document.getElementById('statusMessage');

// 按讚本地儲存管理 (防止重複按讚，支援收回讚)
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

// 防止 XSS 攻擊的安全過濾函式
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ==========================================
// 2. 主要渲染：同時撈取「貼文」與「留言」
// ==========================================
async function fetchPosts() {
    try {
        // 抓取貼文列表
        const { data: posts, error: postError } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (postError) throw postError;

        // 抓取留言列表
        const { data: comments, error: commentError } = await supabase
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

            // 過濾出屬於這篇貼文的留言
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
                        <button type="button" onclick="submitComment('${post.id}')" class="comment-submit-btn">回覆</button>
                    </div>
                </div>
            `;
            postsContainer.appendChild(card);
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
    const likedPosts = getLikedPosts();
    const isAlreadyLiked = likedPosts.includes(postId);
    const newLikesCount = isAlreadyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

    // 先跑畫面視覺更新（優雅降級體驗）
    toggleLocalLike(postId);
    fetchPosts(); 

    try {
        const { error } = await supabase.from('posts').update({ likes: newLikesCount }).eq('id', postId);
        if (error) throw error;
    } catch (error) {
        console.error("按讚失敗，回滾狀態:", error);
        toggleLocalLike(postId); // 失敗則回滾
        fetchPosts();
    }
};

// ==========================================
// 4. 處理「發布新貼文」
// ==========================================
if (postForm) {
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('postTitle').value.trim();
        const content = document.getElementById('postContent').value.trim();
        const submitBtn = document.getElementById('submitBtn');

        if (!title || !content) return;
        submitBtn.disabled = true;

        try {
            const { error } = await supabase.from('posts').insert([{ title, content, likes: 0 }]);
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
window.submitComment = async function(postId) {
    const inputElement = document.getElementById(`input-${postId}`);
    if (!inputElement) return;
    
    const content = inputElement.value.trim();

    if (!content) {
        alert('回覆內容不能留空喔！');
        return;
    }

    try {
        // 寫入 comments 資料表
        const { error } = await supabase
            .from('comments')
            .insert([{ post_id: postId, content: content }]);

        if (error) throw error;
        
        inputElement.value = ''; // 清空特定輸入框
        await fetchPosts();      // 重新整理貼文牆與留言區
    } catch (error) {
        alert('留言失敗，請確認 Supabase Table 與 RLS 開啟！');
        console.error("留言詳細錯誤資訊:", error);
    }
};

// 頁面加載完成後自動初始化
if (postsContainer) {
    fetchPosts();
}