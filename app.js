// ==========================================
// 1. 初始化 Supabase
// ==========================================
const SUPABASE_URL = 'https://uzusjobhfiznykncrfxf.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_Rn8znWY2E2EHHZE9wVGM1A_hs1pg-Sb'; 

let supabaseClient;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) { console.error(err); }

const postForm = document.getElementById('postForm');
const postsContainer = document.getElementById('postsContainer');

// ==========================================
// 2. 撈取與渲染
// ==========================================
// ==========================================
// 核心：撈取資料 (保持你原本的 UI 結構)
// ==========================================
// ==========================================
// 1. 核心：渲染函數 (不破壞原樣式)
// ==========================================
async function fetchPosts() {
    if (!supabaseClient) return;
    
    // 獲取貼文與留言
    const { data: posts } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false });
    const { data: comments } = await supabaseClient.from('comments').select('*');

    postsContainer.innerHTML = '';
    const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '[]');

    posts.forEach(post => {
        const postComments = comments ? comments.filter(c => c.post_id === post.id) : [];
        const isLiked = likedPosts.includes(String(post.id));

        const card = document.createElement('div');
        card.className = 'post-card'; 
        // 這裡維持你原本的 HTML 結構與 Class，確保 CSS 不會失效
        card.innerHTML = `
            <h4>${post.title}</h4>
            <p>${post.content}</p>
            <button class="heart-btn ${isLiked ? 'liked' : ''}" onclick="handleLikeClick('${post.id}', ${post.likes_count})">
                ❤ <span>讚 ${post.likes_count || 0}</span>
            </button>
            <div class="comments-list">
                ${postComments.map(c => `<p class="comment-item">匿名同學: ${c.content}</p>`).join('')}
            </div>
            <div class="comment-input-wrapper">
                <input type="text" id="input-${post.id}" placeholder="回覆...">
                <button onclick="submitComment('${post.id}')">送出</button>
            </div>
        `;
        postsContainer.appendChild(card);
    });
}

// ==========================================
// 按讚邏輯：只切換 class，不改動 HTML 結構
// ==========================================
window.handleLikeClick = async function(postId, currentLikes) {
    const numericId = parseInt(postId, 10);
    const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '[]');
    const isAlreadyLiked = likedPosts.includes(String(postId));
    const newCount = isAlreadyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

    // 更新本地狀態與 UI
    const updatedLiked = isAlreadyLiked 
        ? likedPosts.filter(id => id !== String(postId)) 
        : [...likedPosts, String(postId)];
    localStorage.setItem('likedPosts', JSON.stringify(updatedLiked));

    // 重新載入以更新讚數 (或你也可以寫入後直接修改該按鈕的文字)
    await supabaseClient.from('posts').update({ likes_count: newCount }).eq('id', numericId);
    fetchPosts();
};

// ==========================================
// 4. 回覆功能
// ==========================================
window.submitComment = async function(postId) {
    const input = document.getElementById(`input-${postId}`);
    if (!input || !input.value.trim()) return;

    try {
        const { error } = await supabaseClient
            .from('comments')
            .insert([{ post_id: parseInt(postId, 10), content: input.value.trim() }]);

        if (error) throw error;
        input.value = '';
        fetchPosts();
    } catch (err) {
        console.error("留言失敗", err);
    }
};

// ==========================================
// 5. 初始化與發文
// ==========================================
if (postForm) {
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('postTitle').value.trim();
        const content = document.getElementById('postContent').value.trim();
        await supabaseClient.from('posts').insert([{ title, content }]);
        postForm.reset();
        fetchPosts();
    });
}

fetchPosts();