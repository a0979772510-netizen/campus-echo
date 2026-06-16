// ==========================================
// 1. 初始化 Supabase 帳戶連接資訊 (變數名修正，防止重複宣告報錯)
// ==========================================
const CONFIG_URL = 'https://uzusjobhfiznykncrfxf.supabase.co'; 
const CONFIG_KEY = 'sb_publishable_Rn8znWY2E2EHHZE9wVGM1A_hs1pg-Sb'; // 填入你原本長長的那串 anon key

const api = supabase.createClient(CONFIG_URL, CONFIG_KEY);

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
    if (liked.includes(postId)) liked = liked.filter(id => id !== postId);
    else liked.push(postId);
    localStorage.setItem('likedPosts', JSON.stringify(liked));
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ==========================================
// 2. 主要渲染：抓取貼文與對應留言
// ==========================================
async function fetchPosts() {
    try {
        // 抓取貼文
        const { data: posts, error: postError } = await api
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (postError) throw postError;

        // 抓取所有留言
        const { data: comments, error: commentError } = await api
            .from('comments')
            .select('*')
            .order('created_at', { ascending: true });

        if (commentError) throw commentError;

        if (statusMessage) statusMessage.style.display = 'none';
        postsContainer.innerHTML = '';

        if (posts.length === 0) {
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
            
            postComments.forEach(c => {
                commentsHtml += `
                    <div class="comment-item">
                        <span class="comment-user">B${postComments.indexOf(c) + 1}：</span>
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
                        <button onclick="submitComment('${post.id}')" class="comment-submit-btn">回覆</button>
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

    toggleLocalLike(postId);
    fetchPosts(); 

    try {
        const { error } = await api.from('posts').update({ likes: newLikesCount }).eq('id', postId);
        if (error) throw error;
    } catch (error) {
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
        const title = document.getElementById('postTitle').value.trim();
        const content = document.getElementById('postContent').value.trim();
        const submitBtn = document.getElementById('submitBtn');

        if (!title || !content) return;
        submitBtn.disabled = true;

        try {
            const { error } = await api.from('posts').insert([{ title, content, likes: 0 }]);
            if (error) throw error;
            postForm.reset();
            await fetchPosts();
        } catch (error) {
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
    const content = inputElement.value.trim();

    if (!content) return;

    try {
        const { error } = await api.from('comments').insert([{ post_id: postId, content: content }]);
        if (error) throw error;
        inputElement.value = ''; // 清空輸入框
        await fetchPosts();      // 重新整理貼文牆
    } catch (error) {
        alert('留言失敗，請確認 Supabase Table 與 RLS 開啟！');
        console.error(error);
    }
};

if (postsContainer) {
    fetchPosts();
}