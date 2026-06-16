// ==========================================================================
// 1. 初始化 Supabase 客戶端連線（修正變數名稱重複問題）
// ==========================================================================
const SUPABASE_URL = 'https://uzusjobhfiznykncrfxf.supabase.co'; // <-- 填入你的 Project URL
const SUPABASE_ANON_KEY = 'sb_publishable_Rn8znWY2E2EHHZE9wVGM1A_hs1pg-Sb'; // <-- 填入你的 anon public key

// 我們把變數名稱從 supabase 改成 supabaseClient，避開衝突！
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 抓取 HTML 畫面中的各個重要元素
const postForm = document.getElementById('post-form');
const postTitleInput = document.getElementById('post-title');
const postContentInput = document.getElementById('post-content');
const postsFeed = document.getElementById('posts-feed');
const loadingStatus = document.getElementById('loading-status');

// ==========================================================================
// 2. 從雲端資料庫讀取貼文並渲染到畫面上 (Read)
// ==========================================================================
async function fetchPosts() {
    try {
        // 使用修正後的 supabaseClient
        const { data: posts, error } = await supabaseClient
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 隱藏「連線中」的提示文字
        loadingStatus.style.display = 'none';
        
        // 清空目前的動態牆
        postsFeed.innerHTML = '';

        if (posts.length === 0) {
            postsFeed.innerHTML = '<div class="status-msg">目前還沒有任何迴聲，快來搶頭香吧！</div>';
            return;
        }

        // 轉成 HTML 卡片
        posts.forEach(post => {
            const postDate = new Date(post.created_at).toLocaleString('zh-TW', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const card = document.createElement('div');
            card.className = 'echo-card';
            card.innerHTML = `
                <div class="echo-header">
                    <span class="echo-title"><i class="fa-solid fa-user-secret"></i> ${escapeHtml(post.title)}</span>
                    <span class="echo-time">${postDate}</span>
                </div>
                <div class="echo-content">${escapeHtml(post.content)}</div>
                <div class="echo-footer">
                    <button class="btn-like" onclick="likePost('${post.id}', ${post.likes_count}, this)">
                        <i class="fa-regular fa-heart"></i> 讚 <span>${post.likes_count}</span>
                    </button>
                </div>
            `;
            postsFeed.appendChild(card);
        });

    } catch (error) {
        console.error('讀取資料庫失敗:', error.message);
        loadingStatus.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color: #ef4444;"></i> 連線失敗: ${error.message}`;
    }
}

// ==========================================================================
// 3. 發表新貼文到雲端資料庫 (Create)
// ==========================================================================
postForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = postTitleInput.value.trim();
    const content = postContentInput.value.trim();

    if (!title || !content) return;

    try {
        // 使用修正後的 supabaseClient
        const { error } = await supabaseClient
            .from('posts')
            .insert([{ title: title, content: content }]);

        if (error) throw error;

        postForm.reset();
        await fetchPosts();

    } catch (error) {
        console.error('新增貼文失敗:', error.message);
        alert('發文失敗：' + error.message);
    }
});

// ==========================================================================
// 4. 按讚功能 (Update)
// ==========================================================================
window.likePost = async function(postId, currentLikes, buttonElement) {
    try {
        const ghostSpan = buttonElement.querySelector('span');
        const heartIcon = buttonElement.querySelector('i');
        ghostSpan.textContent = currentLikes + 1;
        heartIcon.className = 'fa-solid fa-heart';
        heartIcon.style.color = '#ef4444';

        // 使用修正後的 supabaseClient
        const { error } = await supabaseClient
            .from('posts')
            .update({ likes_count: currentLikes + 1 })
            .eq('id', postId);

        if (error) throw error;

    } catch (error) {
        console.error('按讚同步失敗:', error.message);
        fetchPosts();
    }
};

// ==========================================================================
// 5. 防止 XSS 攻擊
// ==========================================================================
function escapeHtml(string) {
    return String(string).replace(/[&<>"']/g, function (s) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[s];
    });
}

document.addEventListener('DOMContentLoaded', fetchPosts);