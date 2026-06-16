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
    const idStr = String(postId);
    if (liked.includes(idStr)) {
        liked = liked.filter(id => id !== idStr);
    } else {
        liked.push(idStr);
    }
    localStorage.setItem('likedPosts', JSON.stringify(liked));
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ==========================================
// 2. 撈取與渲染
// ==========================================
async function fetchPosts() {
    try {
        if (!supabaseClient) return;

        const { data: posts, error: postError } = await supabaseClient
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (postError) throw postError;

        let comments = [];
        try {
            const { data: commentsData, error: commentError } = await supabaseClient
                .from('comments')
                .select('*')
                .order('created_at', { ascending: true });
            if (!commentError) comments = commentsData;
        } catch (ce) {
            console.warn("留言撈取失敗:", ce);
        }

        postsContainer.innerHTML = '';
        const likedPosts = getLikedPosts();

        posts.forEach(post => {
            const formattedTime = new Date(post.created_at).toLocaleString('zh-TW', {
                month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
            });

            // 🌟 修正：讀取 likes_count 欄位
            const likesCount = post.likes_count || 0;
            const isLiked = likedPosts.includes(String(post.id));
            const heartClass = isLiked ? 'heart-btn liked' : 'heart-btn';
            const postComments = comments ? comments.filter(c => String(c.post_id) === String(post.id)) : [];

            const card = document.createElement('div');
            card.className = 'post-card';
            card.innerHTML = `
                <div class="post-header"><span>👤 匿名同學</span><span class="post-time">${formattedTime}</span></div>
                <h4 class="post-card-title">${escapeHtml(post.title)}</h4>
                <p class="post-card-content">${escapeHtml(post.content)}</p>
                <div class="post-actions">
                    <button class="${heartClass}" onclick="handleLikeClick('${post.id}', ${likesCount})">
                        ❤ <span>讚 ${likesCount}</span>
                    </button>
                </div>
                <div class="comments-section">
                    <div class="comments-list">${postComments.map((c, i) => `<div class="comment-item">B${i + 1}：${escapeHtml(c.content)}</div>`).join('')}</div>
                    <div class="comment-form-group">
                        <input type="text" id="input-${post.id}" placeholder="回覆..." class="comment-input">
                        <button type="button" data-postid="${post.id}" class="comment-submit-btn">回覆</button>
                    </div>
                </div>
            `;
            postsContainer.appendChild(card);
        });

        document.querySelectorAll('.comment-submit-btn').forEach(btn => {
            btn.addEventListener('click', function() { submitComment(this.getAttribute('data-postid')); });
        });

    } catch (error) {
        console.error("渲染失敗:", error);
    }
}

// ==========================================
// 3. 按讚功能 (修正為 likes_count)
// ==========================================
window.handleLikeClick = async function(postId, currentLikes) {
    if (!supabaseClient) return;
    const isAlreadyLiked = getLikedPosts().includes(String(postId));
    const newCount = isAlreadyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

    toggleLocalLike(postId);
    fetchPosts(); 

    try {
        // 🌟 修正：存入資料庫欄位為 likes_count
        await supabaseClient.from('posts').update({ likes_count: newCount }).eq('id', postId);
    } catch (error) {
        console.error("按讚失敗:", error);
    }
};

// ==========================================
// 4. 發文與留言
// ==========================================
if (postForm) {
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('postTitle').value.trim();
        const content = document.getElementById('postContent').value.trim();
        try {
            // 🌟 修正：發文時不需再傳入 likes_count (資料庫有預設值)
            await supabaseClient.from('posts').insert([{ title, content }]);
            postForm.reset();
            await fetchPosts();
        } catch (err) { alert('發文失敗'); }
    });
}

async function submitComment(postId) {
    const input = document.getElementById(`input-${postId}`);
    if (!input || !input.value.trim()) return;
    try {
        await supabaseClient.from('comments').insert([{ post_id: postId, content: input.value.trim() }]);
        input.value = '';
        await fetchPosts();
    } catch (err) { alert('留言失敗'); }
}

if (postsContainer) fetchPosts();