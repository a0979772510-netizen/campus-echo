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
const statusMessage = document.getElementById('statusMessage'); // 確保 HTML 有這個 ID

// ==========================================
// 2. 核心功能：撈取與渲染 (清理連線狀態列)
// ==========================================
async function fetchPosts() {
    if (!supabaseClient) return;
    
    try {
        const { data: posts, error } = await supabaseClient
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 🌟 關鍵修正：成功撈取後隱藏連線狀態列
        if (statusMessage) statusMessage.style.display = 'none';
        
        postsContainer.innerHTML = '';
        const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '[]');

        posts.forEach(post => {
            const count = post.likes_count || 0;
            const isLiked = likedPosts.includes(String(post.id));
            
            const card = document.createElement('div');
            card.className = 'post-card';
            card.innerHTML = `
                <h4>${post.title}</h4>
                <p>${post.content}</p>
                <button class="${isLiked ? 'liked' : ''}" onclick="handleLikeClick('${post.id}', ${count})">
                    ❤ 讚 ${count}
                </button>
                <div class="comments-list"></div>
                <input type="text" id="input-${post.id}" placeholder="回覆...">
                <button onclick="submitComment('${post.id}')">送出回覆</button>
            `;
            postsContainer.appendChild(card);
        });
    } catch (err) {
        console.error("渲染失敗:", err);
        if (statusMessage) statusMessage.innerText = '載入失敗，請檢查網路';
    }
}

// ==========================================
// 3. 按讚功能 (對應 likes_count)
// ==========================================
window.handleLikeClick = async function(postId, currentLikes) {
    const numericId = parseInt(postId, 10);
    const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '[]');
    const isAlreadyLiked = likedPosts.includes(String(postId));
    const newCount = isAlreadyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

    // 更新本地狀態
    const updatedLiked = isAlreadyLiked 
        ? likedPosts.filter(id => id !== String(postId)) 
        : [...likedPosts, String(postId)];
    localStorage.setItem('likedPosts', JSON.stringify(updatedLiked));

    // 更新資料庫
    await supabaseClient.from('posts').update({ likes_count: newCount }).eq('id', numericId);
    fetchPosts();
};

// ==========================================
// 4. 回覆功能 (確保 post_id 為數字)
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
        alert('留言失敗：請確認 post_id 欄位已建立');
    }
};

// ==========================================
// 5. 發文
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

// 啟動
fetchPosts();