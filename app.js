// ==========================================
// 1. 初始化 Supabase
// ==========================================
const SUPABASE_URL = 'https://uzusjobhfiznykncrfxf.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_Rn8znWY2E2EHHZE9wVGM1A_hs1pg-Sb'; 

let supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const postsContainer = document.getElementById('postsContainer');

// ==========================================
// 2. 渲染邏輯 (保留你原本的 Class 結構)
// ==========================================
async function fetchPosts() {
    // 獲取數據
    const { data: posts } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false });
    const { data: comments } = await supabaseClient.from('comments').select('*');

    postsContainer.innerHTML = '';
    const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '[]');

    posts.forEach(post => {
        const isLiked = likedPosts.includes(String(post.id));
        const postComments = comments ? comments.filter(c => c.post_id === post.id) : [];

        const card = document.createElement('div');
        card.className = 'post-card'; // 這裡維持你原本的 CSS Class
        
        // 這裡將「結構」與「變數」分離，避免覆蓋掉你的按鈕樣式
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
                <input type="text" id="input-${post.id}" placeholder="回覆...">
                <button class="submit-comment-btn" onclick="submitComment('${post.id}')">送出回覆</button>
            </div>
        `;
        postsContainer.appendChild(card);
    });
}

// ==========================================
// 3. 按讚 (只改狀態，不改結構)
// ==========================================
window.handleLikeClick = async function(postId, currentLikes) {
    const isLiked = JSON.parse(localStorage.getItem('likedPosts') || '[]').includes(String(postId));
    const newCount = isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;
    
    // 更新本地狀態
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

fetchPosts();