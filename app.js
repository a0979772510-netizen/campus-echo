// ==========================================
// 1. 初始化 Supabase
// ==========================================
const SUPABASE_URL = 'https://uzusjobhfiznykncrfxf.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_Rn8znWY2E2EHHZE9wVGM1A_hs1pg-Sb'; 

let supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const postsContainer = document.getElementById('postsContainer');
const postForm = document.getElementById('postForm');

// ==========================================
// 2. 核心：渲染與撈取資料
// ==========================================
async function fetchPosts() {
    if (!supabaseClient) return;

    // 撈取貼文與留言
    const { data: posts } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false });
    const { data: comments } = await supabaseClient.from('comments').select('*');

    postsContainer.innerHTML = '';
    const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '[]');

    posts.forEach(post => {
        const isLiked = likedPosts.includes(String(post.id));
        const postComments = comments ? comments.filter(c => c.post_id === post.id) : [];

        const card = document.createElement('div');
        card.className = 'post-card';
        card.innerHTML = `
            <div class="post-header"><span>匿名同學</span></div>
            <h4>${post.title}</h4>
            <p>${post.content}</p>
            
            <button class="heart-btn ${isLiked ? 'liked' : ''}" onclick="handleLikeClick('${post.id}', ${post.likes_count || 0})">
                ❤ <span>讚 ${post.likes_count || 0}</span>
            </button>

            <div class="comments-list">
                ${postComments.map(c => `<p class="comment-item">匿名: ${c.content}</p>`).join('')}
            </div>
            
            <div class="comment-input-wrapper">
                <input type="text" id="input-${post.id}" placeholder="回覆..." class="comment-input">
                <button class="comment-submit-btn" onclick="submitComment('${post.id}')">送出回覆</button>
            </div>
        `;
        postsContainer.appendChild(card);
    });
}

// ==========================================
// 3. 按讚邏輯 (僅顏色變換，保持設計質感)
// ==========================================
window.handleLikeClick = async function(postId, currentLikes) {
    const isLiked = JSON.parse(localStorage.getItem('likedPosts') || '[]').includes(String(postId));
    const newCount = isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;
    
    let liked = JSON.parse(localStorage.getItem('likedPosts') || '[]');
    liked = isLiked ? liked.filter(id => id !== String(postId)) : [...liked, String(postId)];
    localStorage.setItem('likedPosts', JSON.stringify(liked));

    await supabaseClient.from('posts').update({ likes_count: newCount }).eq('id', parseInt(postId, 10));
    fetchPosts();
};

// ==========================================
// 4. 送出回覆
// ==========================================
window.submitComment = async function(postId) {
    const input = document.getElementById(`input-${postId}`);
    if (!input || !input.value.trim()) return;

    await supabaseClient.from('comments').insert([{ post_id: parseInt(postId, 10), content: input.value.trim() }]);
    input.value = '';
    fetchPosts();
};

// ==========================================
// 5. 發文邏輯
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