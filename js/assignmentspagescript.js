const client = supabase.createClient('YOUR_URL', 'YOUR_KEY');
let currentUser = null;
let activeTaskId = null;

$(document).ready(async () => {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return window.location.href = 'login.html';

    // ดึงข้อมูลโปรไฟล์
    const { data: profile } = await client.from('profiles').select('*').eq('id', session.user.id).single();
    currentUser = profile;

    $('#navAvatar, #streamAvatar').attr('src', profile.avatar_url || 'https://via.placeholder.com/100');
    if (profile.role === 'admin' || profile.role === 'hr') $('#hrOnlyAction').removeClass('hidden');

    switchTab('stream');
});

function switchTab(tab) {
    $('.nav-tab').removeClass('active');
    $(`#tab-${tab}`).addClass('active');
    $('.tab-content').addClass('hidden');
    $(`#section-${tab}`).removeClass('hidden');

    if (tab === 'stream') loadStream();
    if (tab === 'classwork') loadClasswork();
    if (tab === 'people') loadPeople();
}

// --- STREAM ---
async function loadStream() {
    const { data: tasks } = await client.from('assignments').select('*').order('created_at', { ascending: false });
    const list = $('#streamList').empty();
    tasks.forEach(t => {
        list.append(`
            <div onclick="openTaskModal('${t.id}')" class="bg-white border rounded-xl p-4 shadow-sm cursor-pointer hover:border-[#721c24] flex items-center gap-4 transition">
                <div class="w-10 h-10 bg-[#721c24] text-white rounded-full flex items-center justify-center"><i class="fa-solid fa-file-lines"></i></div>
                <div>
                    <p class="text-sm">HR ได้โพสต์งานใหม่: <span class="font-bold">${t.title}</span></p>
                    <p class="text-[10px] text-gray-400">${new Date(t.created_at).toLocaleDateString('th-TH')}</p>
                </div>
            </div>
        `);
    });
}

// --- CLASSWORK ---
async function loadClasswork() {
    const { data: tasks } = await client.from('assignments').select('*').order('due_date', { ascending: true });
    const list = $('#classworkList').empty();
    list.append(`<h2 class="text-[#721c24] text-xl font-bold border-b pb-2 mb-4">งานทั้งหมด</h2>`);
    
    tasks.forEach(t => {
        list.append(`
            <div onclick="openTaskModal('${t.id}')" class="assignment-card bg-white border-b p-4 flex justify-between items-center cursor-pointer transition">
                <div class="flex items-center gap-4">
                    <i class="fa-solid fa-file-lines text-gray-400"></i>
                    <span class="font-medium">${t.title}</span>
                </div>
                <span class="text-xs text-gray-400">กำหนดส่ง ${new Date(t.due_date).toLocaleDateString('th-TH')}</span>
            </div>
        `);
    });
}

// --- TASK MODAL & LOGIC ---
async function openTaskModal(id) {
    activeTaskId = id;
    const { data: task } = await client.from('assignments').select('*').eq('id', id).single();
    const { data: sub } = await client.from('student_assignments').select('*').eq('assignment_id', id).eq('user_id', currentUser.id).single();

    $('#mTaskTitle').text(task.title);
    $('#mTaskDesc').text(task.description);
    $('#mTaskDue').text(new Date(task.due_date).toLocaleDateString('th-TH'));
    $('#taskModal').removeClass('hidden');

    renderStatus(sub);
    loadComments();
}

function renderStatus(sub) {
    const badge = $('#modalStatus');
    if (!sub) {
        badge.text('Assigned').addClass('bg-blue-100 text-blue-600');
        $('#submitBtn').text('ส่งงาน').attr('onclick', 'submitWork()');
    } else {
        badge.text('Turned in').removeClass('bg-blue-100 text-blue-600').addClass('bg-green-100 text-green-600');
        $('#workUrl').val(sub.submission_url).attr('disabled', true);
        $('#submitBtn').text('ยกเลิกการส่ง').attr('onclick', 'unsubmitWork()').addClass('bg-gray-500');
    }
}

// --- COMMENTS ---
async function loadComments() {
    const { data: cms } = await client.from('comments').select('*, profiles(full_name, avatar_url)').eq('assignment_id', activeTaskId);
    const pubList = $('#publicComments').empty();
    const privList = $('#privateComments').empty();

    cms.forEach(c => {
        const html = `
            <div class="flex gap-3">
                <img src="${c.profiles.avatar_url}" class="w-8 h-8 rounded-full">
                <div>
                    <p class="text-xs font-bold">${c.profiles.full_name} <span class="font-normal text-gray-400 ml-2">${new Date(c.created_at).toLocaleTimeString()}</span></p>
                    <p class="text-sm">${c.content}</p>
                </div>
            </div>
        `;
        if (c.is_private) {
            if (c.author_id === currentUser.id || currentUser.role === 'hr') privList.append(html);
        } else {
            pubList.append(html);
        }
    });
}

async function sendComment(isPrivate) {
    const input = isPrivate ? $('#privateMsg') : $('#publicMsg');
    const content = input.val().trim();
    if (!content) return;

    await client.from('comments').insert({
        assignment_id: activeTaskId,
        author_id: currentUser.id,
        content: content,
        is_private: isPrivate,
        target_user_id: isPrivate ? currentUser.id : null
    });

    input.val('');
    loadComments();
}

// --- SUBMISSION ---
async function submitWork() {
    const url = $('#workUrl').val();
    if (!url) return Swal.fire('ลืมใส่ลิงก์!', 'กรุณาแนบลิงก์งานก่อนส่ง', 'warning');

    await client.from('student_assignments').upsert({
        assignment_id: activeTaskId,
        user_id: currentUser.id,
        submission_url: url,
        status: 'submitted'
    });
    
    Swal.fire('ส่งงานสำเร็จ!', '', 'success');
    openTaskModal(activeTaskId);
}

// --- PEOPLE ---
async function loadPeople() {
    const { data: users } = await client.from('profiles').select('*').order('full_name');
    const tList = $('#teacherList').empty();
    const sList = $('#studentList').empty();

    users.forEach(u => {
        const html = `<div class="flex items-center gap-4 py-2 border-b border-gray-50">
            <img src="${u.avatar_url || 'https://via.placeholder.com/100'}" class="w-8 h-8 rounded-full">
            <span class="text-sm">${u.full_name}</span>
        </div>`;
        if (u.role === 'hr' || u.role === 'admin') tList.append(html);
        else sList.append(html);
    });
}

function closeTaskModal() { $('#taskModal').addClass('hidden'); }
