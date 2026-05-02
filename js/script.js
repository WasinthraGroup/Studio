const SUPABASE_URL = 'https://fucrcbuqbpnbftyljqgi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Y3JjYnVxYnBuYmZ0eWxqcWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzc1MTIsImV4cCI6MjA5MTI1MzUxMn0.XXKIgZ_9Ciciq3qfgINK48J70HbunRyP28p1MiIv6To';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;
let activeTaskId = null;

$(document).ready(async function() {
    const { data: { session } } = await client.auth.getSession();
    const currentPage = window.location.pathname.split("/").pop() || 'index.html';

    if (session) {
        const { data: profile } = await client
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        currentUser = profile;
    }

    if (currentPage === 'login.html') {
        if (session) { window.location.href = 'workshop.html'; return; }
    } 
    else if (currentPage === 'workshop.html' || currentPage === 'assignments.html') {
        if (!session) { window.location.href = 'login.html'; return; }
        const { data: profile } = await client.from('profiles').select('*').eq('id', session.user.id).single();
        currentUser = profile;
        
        if (currentPage === 'workshop.html') initWorkshop(session);
        if (currentPage === 'assignments.html') initAssignmentsPage();
    } 
    else if (currentPage === 'register.html') {
        initRegister();
    } 
    else if (currentPage === 'index.html' || currentPage === '') {
        loadContents('news', 'newsContainer');
        loadContents('projects', 'projectsContainer');
    }
    else if (currentPage === 'projects.html') {
        loadContents('projects', 'projectsGrid');
    }

    updateNavbarUI(session);

    $('#loginForm').submit(async (e) => {
        e.preventDefault();
        const userInput = $('#username').val().trim().toLowerCase();
        const password = $('#password').val();

        if (!userInput || !password) {
            Swal.fire({ icon: 'info', title: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
            return;
        }

        Swal.fire({ title: 'กำลังเข้าสู่ระบบ...', didOpen: () => Swal.showLoading() });

        try {
            let finalEmail = userInput;

            if (!userInput.includes('@')) {
                const { data: profile, error: profileError } = await client
                    .from('profiles')
                    .select('email')
                    .eq('username', userInput)
                    .single();

                if (profileError || !profile) {
                    Swal.fire({ icon: 'error', title: 'ไม่พบชื่อผู้ใช้งานนี้' });
                    return;
                }
                
                finalEmail = profile.email;
            }

            const { error: authError } = await client.auth.signInWithPassword({
                email: finalEmail,
                password: password
            });

            if (authError) {
                Swal.fire({ icon: 'error', title: 'รหัสผ่านไม่ถูกต้อง' });
            } else {
                window.location.href = 'workshop.html';
            }
        } catch (err) {
            console.error("Login Error:", err);
            Swal.fire({ icon: 'error', title: 'ระบบขัดข้อง' });
        }
    });
    

    $(document).on('click', '#logoutBtn', async () => {
        await client.auth.signOut();
        window.location.href = 'index.html';
    });
});

async function initWorkshop(session) {
    $('#userDisplay').text("ผู้ใช้งาน: " + (currentUser.full_name || currentUser.username)).removeClass('hidden');
    if (currentUser.role === 'hr') {
        setupHRFeatures();
    }
    renderCalendar(currentUser.id, currentUser.role);
    loadAssignmentsListSimple();
    $('body').removeClass('hidden');
}

async function loadAssignmentsListSimple() {
    const { data } = await client.from('assignments').select('*').order('due_date', { ascending: true });
    const container = $('#assignmentList');
    if (!container.length) return;
    container.empty();
    if (!data || data.length === 0) {
        container.append('<p class="text-center py-10 text-gray-400">ไม่มีงานที่มอบหมาย</p>');
        return;
    }
    data.forEach(task => {
        container.append(`
            <div onclick="window.location.href='assignments.html'" class="p-4 border rounded-xl mb-3 bg-white shadow-sm cursor-pointer hover:border-[#721c24] transition-all">
                <div class="flex justify-between">
                    <h4 class="font-bold">${task.title}</h4>
                    <span class="text-xs text-red-500">DUE: ${new Date(task.due_date).toLocaleDateString('th-TH')}</span>
                </div>
                <p class="text-xs text-gray-500 mt-2">${task.description || '-'}</p>
            </div>
        `);
    });
}

function initAssignmentsPage() {
    $('#navAvatar, #streamAvatar').attr('src', currentUser.avatar_url || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png');
    
    if (currentUser.role === 'hr' || currentUser.role === 'admin') {
        $('#hrOnlyAction').removeClass('hidden');
        setupHRFeatures();
    }
    
    switchTab('stream');
    $('body').removeClass('hidden');
}

function switchTab(tab) {
    $('.nav-tab').removeClass('active');
    $(`#tab-${tab}`).addClass('active');
    $('.tab-content').addClass('hidden');
    $(`#section-${tab}`).removeClass('hidden');
    if (tab === 'stream') loadStream();
    if (tab === 'classwork') loadClasswork();
    if (tab === 'people') loadPeople();
}

let currentOpenTaskId = null; 

async function viewTaskDetails(taskId) {
    currentOpenTaskId = taskId;
    const isHR = (currentUser.role === 'hr' || currentUser.role === 'admin');

    $('#feedbackSection').addClass('hidden');

    if (isHR) {
        $('#submissionTitle').text('การตอบกลับจากพนักงาน');
        $('#submissionView').html(`
            <div class="space-y-4">
                <div id="hrSubmissionsList" class="divide-y max-h-[400px] overflow-y-auto">
                    <p class="text-center py-4 text-gray-400 text-xs italic">กำลังดึงข้อมูลผู้ส่งงาน...</p>
                </div>
            </div>
        `);
        loadSubmissionsForHR(taskId); 
    } else {
        $('#submissionTitle').text('งานของคุณ');
        checkUserSubmission(taskId); 
    }

    $('#taskModal').removeClass('hidden');
}



function openCheckModal(id, currentStatus, currentFeedback) {
    $('#targetWorkId').val(id);
    $('#workStatus').val(currentStatus || 'pending');
    $('#workFeedback').val(currentFeedback || '');
    $('#checkWorkModal').removeClass('hidden').removeClass('animate__zoomOut').addClass('animate__zoomIn');
}

function closeCheckWorkModal() {
    $('#checkWorkModal').addClass('hidden');
}

async function loadSubmissionsForHR(taskId) {
    const listContainer = $('#hrSubmissionsList');
    listContainer.html('<p class="text-center py-4 text-gray-400 text-xs">กำลังโหลด...</p>');

    const { data: submissions, error } = await client
        .from('submissions') 
        .select('*, profiles(full_name, avatar_url, username)')
        .eq('task_id', taskId);

    if (error) return console.error(error);
    listContainer.empty();

    if (submissions.length === 0) {
        listContainer.html('<p class="text-center py-8 text-gray-400 text-sm italic">ยังไม่มีผู้ส่งงานนี้</p>');
        return;
    }

    const statusColors = { 
        pending: 'bg-yellow-100 text-yellow-700', 
        approved: 'bg-green-100 text-green-700', 
        rejected: 'bg-red-100 text-red-700' 
    };

    submissions.forEach(sub => {
        const avatar = sub.profiles?.avatar_url || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png';
        const name = sub.profiles?.full_name || sub.profiles?.username || 'ไม่ทราบชื่อ';

        let submittedAt = "ไม่ระบุเวลา";
        if (sub.submitted_at) {
            const dateObj = new Date(sub.submitted_at);
            if (!isNaN(dateObj)) {
                submittedAt = dateObj.toLocaleString('th-TH', {
                    day: '2-digit',
                    month: 'short',
                    year: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Bangkok'
                });
            }
        }

        const hasUrl = sub.file_url && sub.file_url.trim() !== "";
        const fileLink = hasUrl ? `
            <a href="${sub.file_url}" target="_blank" class="text-[10px] text-blue-500 hover:underline">
                <i class="fa-solid fa-link"></i> ดูไฟล์งาน
            </a>
        ` : '<span class="text-[10px] text-gray-400 italic">ไม่ได้แนบลิงก์</span>';

        listContainer.append(`
            <div class="py-4 flex justify-between items-center border-b last:border-0 border-gray-50 group">
                <div class="flex items-center gap-3">
                    <img src="${avatar}" class="w-10 h-10 rounded-full border shadow-sm">
                    <div>
                        <p class="text-sm font-bold text-gray-700">${name}</p>
                        <div class="flex items-center gap-3">
                            ${fileLink}
                            <span class="text-[10px] text-gray-400">
                                <i class="fa-regular fa-clock"></i> ${submittedAt}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col items-end gap-2">
                    <span class="text-[9px] font-bold px-2 py-0.5 rounded-full ${statusColors[sub.status] || 'bg-gray-100'} uppercase">${sub.status}</span>
                    <button onclick="openCheckModal('${sub.id}', '${sub.status}', '${(sub.feedback || '').replace(/'/g, "\\'")}')" 
                            class="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-sm">
                        ตรวจงาน
                    </button>
                </div>
            </div>
        `);
    });
}

$('#checkWorkForm').off('submit').on('submit', async function(e) {
    e.preventDefault();
    const workId = $('#targetWorkId').val();
    const status = $('#workStatus').val();
    const feedback = $('#workFeedback').val();

    closeCheckWorkModal();

    Swal.fire({ title: 'กำลังบันทึกผล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const { error } = await client.from('submissions') 
            .update({ 
                status: status, 
                feedback: feedback,
                checked_by: currentUser.id 
            })
            .eq('id', workId);

        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: 'สำเร็จ!',
            text: 'บันทึกผลการตรวจเรียบร้อย',
            confirmButtonColor: '#721c24'
        });

      
        if (typeof currentOpenTaskId !== 'undefined') {
            loadSubmissionsForHR(currentOpenTaskId);
        }

    } catch (err) {
        console.error(err);
        Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
        $('#checkWorkModal').removeClass('hidden'); 
    }
});




function openAnnounceModal() {
    if (currentUser.role !== 'hr' && currentUser.role !== 'admin') {
        return Swal.fire("ขออภัย", "เฉพาะผู้ดูแลเท่านั้นที่โพสต์ประกาศได้", "info");
    }
    $('#announceModal').removeClass('hidden').css('display', 'flex');
    $('#announceText').focus();
}

function closeAnnounceModal() {
    $('#announceModal').addClass('hidden').css('display', 'none');
    $('#announceForm')[0].reset();
}

$(document).on('submit', '#announceForm', async function(e) {
    e.preventDefault();
    const content = $('#announceText').val().trim();
    
    if (!content) return;

    Swal.fire({ title: 'กำลังโพสต์...', didOpen: () => Swal.showLoading() });

    try {
        const { error } = await client.from('contents').insert([{
            type: 'announcement', 
            title: 'โพสต์',
            description: content,
            //author_id: currentUser.id 
        }]);

        if (error) throw error;

        await Swal.fire('สำเร็จ', 'โพสต์ประกาศเรียบร้อยแล้ว', 'success');
        closeAnnounceModal();
        loadStream(); 
    } catch (err) {
        console.error("Announce Error:", err);
        Swal.fire('ล้มเหลว', err.message, 'error');
    }
});






async function loadStream() {
    const list = $('#streamList').empty();
    
    const { data: tasks } = await client.from('assignments').select('*').order('created_at', { ascending: false });
    
    const { data: announces } = await client.from('contents').select('*').eq('type', 'announcement').order('created_at', { ascending: false });

    let allStream = [
        ...(tasks || []).map(t => ({ ...t, streamType: 'task' })),
        ...(announces || []).map(a => ({ ...a, streamType: 'note' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (allStream.length === 0) {
        list.append('<p class="text-center py-10 text-gray-400 italic">งานว่าง</p>');
        return;
    }

    allStream.forEach(item => {
        if (item.streamType === 'task') {
            list.append(`
                <div onclick="openTaskModal('${item.id}')" class="bg-white border rounded-xl p-4 shadow-sm cursor-pointer hover:border-[#721c24] flex items-center gap-4 transition">
                    <div class="w-10 h-10 bg-[#721c24] text-white rounded-full flex items-center justify-center"><i class="fa-solid fa-file-lines"></i></div>
                    <div>
                        <p class="text-sm">${currentUser?.full_name ? currentUser.full_name + ' ได้โพสต์งานใหม่: ' : 'งานใหม่: '}<span class="font-bold">${item.title}</span></p>
                        <p class="text-[10px] text-gray-400">${new Date(item.created_at).toLocaleString('th-TH')}</p>
                    </div>
                </div>
            `);
        } else {
            list.append(`
                <div class="bg-white border rounded-xl p-5 shadow-sm space-y-3">
                    <div class="flex items-center gap-3">
                        <img src="${currentUser.avatar_url || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png'}" class="w-8 h-8 rounded-full">
                        <div>
                            <p class="text-xs font-bold">${currentUser?.full_name ? 'โพสต์ใหม่ของ ' + currentUser.full_name + ': ' : 'โพสต์ใหม่: '}</p>
                            <p class="text-[9px] text-gray-400">${new Date(item.created_at).toLocaleString('th-TH')}</p>
                        </div>
                    </div>
                    <div class="text-sm text-gray-700 leading-relaxed">${urlToLink(item.description)}</div>
                </div>
            `);
        }
    });
}

async function loadClasswork() {
    const { data: tasks, error } = await client.from('assignments').select('*').order('created_at', { ascending: false });
    const container = $('#classworkList');
    container.empty();

    tasks.forEach(task => {
        container.append(`
            <div onclick="viewTaskDetails('${task.id}')" class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer group">
                <div class="flex justify-between items-start">
                    <div class="flex gap-4">
                        <div class="w-12 h-12 bg-gray-100 text-[#721c24] rounded-full flex items-center justify-center text-xl group-hover:bg-[#721c24] group-hover:text-white transition">
                            <i class="fa-solid fa-file-lines"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-lg">${task.title}</h3>
                            <p class="text-xs text-gray-400 uppercase tracking-wider">โพสต์เมื่อ: ${new Date(task.created_at).toLocaleDateString('th-TH')}</p>
                        </div>
                    </div>
                    <span class="text-xs font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                        DUE: ${new Date(task.due_date).toLocaleDateString('th-TH')}
                    </span>
                </div>
            </div>
        `);
    });
}

function openCreateTaskModal() {
    $('#createTaskModal').removeClass('hidden').css('display', 'flex');
}

function closeCreateTaskModal() {
    $('#createTaskModal').addClass('hidden').css('display', 'none');
}

function urlToLink(text) {
    if (!text) return '-';
    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(urlPattern, (url) => {
        return `<a href="${url}" target="_blank" class="text-blue-500 underline hover:text-blue-700">${url}</a>`;
    });
}

async function openTaskModal(id) {
    activeTaskId = id;
    const isHR = (currentUser.role === 'hr' || currentUser.role === 'admin');

    $('#submissionView').html('<div class="flex justify-center py-4"><i class="fa-solid fa-circle-notch fa-spin text-[#721c24] text-xl"></i></div>');

    try {
        const { data: task, error: taskError } = await client
            .from('assignments')
            .select('*')
            .eq('id', id)
            .single();

        if (taskError) throw taskError;

        $('#mTaskTitle').text(task.title);
        $('#mTaskDesc').html(urlToLink(task.description) || 'ไม่มีรายละเอียด');
        $('#mTaskDue').text(new Date(task.due_date).toLocaleDateString('th-TH'));

        if (isHR) {
            $('#submissionView').html(`
                <div class="space-y-4">
                    <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b pb-2">รายชื่อผู้ส่งงาน</h4>
                    <div id="hrSubmissionsList" class="divide-y"></div>
                </div>
            `);
            loadSubmissionsForHR(id);
        } else {
            const { data: subData, error: subError } = await client
                .from('submissions')
                .select('*')
                .eq('task_id', id)
                .eq('user_id', currentUser.id);

            if (subError) throw subError;

            const sub = (subData && subData.length > 0) ? subData[0] : null;

            if (!sub) {
                $('#submissionView').html(`
                    <div class="space-y-3">
                        <input type="url" id="workUrl" placeholder="วางลิงก์งานของคุณ (เช่น Google Drive, Canva)..." 
                            class="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#721c24] outline-none transition-all">
                        <button onclick="submitWork('${id}')" 
                            class="w-full py-3 bg-[#721c24] text-white rounded-xl font-bold shadow-lg hover:opacity-90 active:scale-95 transition-all">
                            ส่งงาน
                        </button>
                    </div>
                `);
            } else {
                renderStatus(sub); 
            }
        }

        $('#taskModal').removeClass('hidden');
        if (typeof loadComments === 'function') loadComments();

    } catch (err) {
        console.error("Modal Error:", err);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลงานได้: ' + err.message, 'error');
    }
}

function renderStatus(sub) {
    const container = $('#submissionView');
    if (!sub) return;

    const statusMap = {
        pending: { text: 'รอตรวจ', color: 'bg-yellow-100 text-yellow-700', icon: 'fa-clock' },
        approved: { text: 'ผ่านแล้ว', color: 'bg-green-100 text-green-700', icon: 'fa-check-circle' },
        rejected: { text: 'ต้องแก้ไข', color: 'bg-red-100 text-red-700', icon: 'fa-circle-exclamation' }
    };

    const s = statusMap[sub.status] || statusMap.pending;

    let displayDate = "ไม่ระบุวันที่";
    if (sub.submitted_at) {
        const dateObj = new Date(sub.submitted_at);
        if (!isNaN(dateObj)) {
            displayDate = dateObj.toLocaleString('th-TH', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok'
            });
        }
    }

    let actionButtons = '';
    if (sub.status === 'pending') {
        actionButtons = `
            <button onclick="unsubmitWork('${sub.id}', '${sub.task_id}')" 
                class="mt-3 w-full py-2 border border-gray-300 text-gray-500 rounded-lg text-[10px] font-bold hover:bg-gray-50 transition">
                ยกเลิกการส่งเพื่อแก้ไข
            </button>
        `;
    }

    const hasUrl = sub.file_url && sub.file_url.trim() !== "";
    const linkButton = hasUrl ? `
        <a href="${sub.file_url}" target="_blank" class="block w-full py-2 bg-white/50 text-center rounded-lg text-xs hover:bg-white transition-all shadow-sm">
            <i class="fa-solid fa-link mr-1"></i> ดูลิงก์ที่ส่งไป
        </a>
    ` : `<div class="text-center py-2 text-[10px] text-gray-500 italic bg-gray-100 rounded-lg">ไม่ได้แนบลิงก์งาน</div>`;

    container.html(`
        <div class="p-4 rounded-xl border ${s.color} mb-4">
            <div class="flex items-center gap-3 font-bold mb-2">
                <i class="fa-solid ${s.icon}"></i>
                <span>สถานะ: ${s.text}</span>
            </div>
            <p class="text-[10px] opacity-80 mb-3 text-gray-600">ส่งเมื่อ: ${displayDate}</p>
            ${linkButton}
            ${actionButtons}
        </div>
        
        ${sub.status === 'rejected' ? `
            <div class="bg-red-50 p-4 rounded-xl border border-red-100">
                <p class="text-[10px] font-bold text-red-500 uppercase mb-1">สิ่งที่ต้องแก้ไข:</p>
                <p class="text-sm text-gray-700 italic mb-4">${sub.feedback || 'ไม่ได้ระบุรายละเอียด'}</p>
                <button onclick="unsubmitWork('${sub.id}', '${sub.task_id}')" 
                    class="w-full py-2 bg-red-500 text-white rounded-lg text-xs font-bold shadow-md hover:bg-red-600 transition">
                    ส่งใหม่
                </button>
            </div>
        ` : ''}
    `);
    
    $('#modalStatus').text(s.text).attr('class', `px-3 py-1 rounded-full text-xs font-bold ${s.color}`);
}

function reSubmit(taskId) {
    openTaskModal(taskId); 
}

async function loadComments() {
    const { data: cms, error } = await client
        .from('comments')
        .select(`
            *,
            profiles:author_id (full_name, avatar_url)
        `)
        .eq('assignment_id', activeTaskId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error loading comments:", error);
        return;
    }

    const pubList = $('#publicComments').empty();
    const privList = $('#privateComments').empty();

    if (cms && cms.length > 0) {
        cms.forEach(c => {
            const commentContent = urlToLink(c.content);
            
            const html = `
                <div class="flex gap-3 mb-4 animate__animated animate__fadeIn">
                    <img src="${c.profiles?.avatar_url || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png'}" 
                         class="w-8 h-8 rounded-full object-cover border border-gray-100">
                    <div class="bg-gray-50 p-3 rounded-2xl rounded-tl-none flex-1">
                        <div class="flex justify-between items-center mb-1">
                            <p class="text-[11px] font-bold text-gray-800">${c.profiles?.full_name || 'Unknown'}</p>
                            <span class="text-[9px] text-gray-400">${new Date(c.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
                        </div>
                        <p class="text-sm text-gray-700 leading-relaxed">${commentContent}</p>
                    </div>
                </div>`;

            if (c.is_private) {
                if (c.author_id === currentUser.id || currentUser.role === 'hr') {
                    privList.append(html);
                }
            } else {
                pubList.append(html);
            }
        });
    } else {
        pubList.append('<p class="text-center text-[10px] text-gray-400 py-2">ยังไม่มีความคิดเห็นสาธารณะ</p>');
        privList.append('<p class="text-center text-[10px] text-gray-400 py-2">ยังไม่มีความคิดเห็นส่วนตัว</p>');
    }
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

async function submitWork(taskId) {
    const url = $('#workUrl').val().trim();

    Swal.fire({ 
        title: 'กำลังส่งงาน...', 
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading() 
    });

    try {
        const { data, error } = await client.from('submissions').insert([{
            task_id: taskId,
            user_id: currentUser.id,
            file_url: url || null, 
            status: 'pending'
        }]).select();

        if (error) throw error;

        await Swal.fire({
            icon: 'success',
            title: 'สำเร็จ!',
            text: 'บันทึกการส่งงานเรียบร้อยแล้ว',
            timer: 1500,
            showConfirmButton: false
        });

        if (data && data.length > 0) {
            renderStatus(data[0]); 
        } else {
            openTaskModal(taskId);
        }

    } catch (err) {
        console.error("Submit Error:", err);
        Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
    }
}

async function unsubmitWork(submissionId, taskId) {
    const result = await Swal.fire({
        title: 'ยืนยันการยกเลิก?',
        text: "คุณต้องการยกเลิกการส่งงานนี้เพื่อแก้ไขใช่หรือไม่?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#721c24',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'ใช่, ยกเลิกเลย',
        cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
        Swal.fire({ title: 'กำลังดำเนินการ...', didOpen: () => Swal.showLoading() });

        try {
            const { error } = await client
                .from('submissions')
                .delete()
                .eq('id', submissionId);

            if (error) throw error;

            await Swal.fire({
                icon: 'success',
                title: 'ยกเลิกสำเร็จ',
                text: 'คุณสามารถส่งงานใหม่ได้ทันที',
                timer: 1500,
                showConfirmButton: false
            });

            openTaskModal(taskId);

        } catch (err) {
            console.error("Unsubmit Error:", err);
            Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
        }
    }
}

async function loadPeople() {
    const { data: users } = await client.from('profiles').select('*').order('full_name');
    const tList = $('#teacherList').empty();
    const sList = $('#studentList').empty();
    users.forEach(u => {
        const html = `<div class="flex items-center gap-4 py-2 border-b border-gray-50">
            <img src="${u.avatar_url || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png'}" class="w-8 h-8 rounded-full">
            <span class="text-sm">${u.full_name}</span>
        </div>`;
        if (u.role === 'hr' || u.role === 'admin') tList.append(html);
        else sList.append(html);
    });
}

function closeTaskModal() {
    $('#taskModal').addClass('hidden');
    currentOpenTaskId = null;
    $('#hrSubmissionsList').empty();
}
function renderCalendar(userId, role) {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        allDaySlot: false,
        selectable: true,
        editable: true,
        locale: 'th',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' },
        eventClick: async function(info) {
            const { isConfirmed } = await Swal.fire({
                title: 'ลบกิจกรรม?',
                text: `ต้องการลบ "${info.event.title}" ใช่หรือไม่?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'ลบออก'
            });
            if (isConfirmed) {
                const { error } = await client.from('schedules').delete().eq('id', info.event.id);
                if (!error) { info.event.remove(); }
            }
        },
        eventChange: async function(info) {
            await client.from('schedules').update({ start_time: info.event.startStr, end_time: info.event.endStr }).eq('id', info.event.id);
        },
        select: async function(info) {
            const { value: type } = await Swal.fire({
                title: 'เลือกประเภท',
                input: 'radio',
                inputOptions: { '#3b82f6': 'ทำงาน (ฟ้า)', '#f59e0b': 'ลา (เหลือง)' }
            });
            if (type) {
                const { value: title } = await Swal.fire({ title: 'หัวข้อ', input: 'text', showCancelButton: true });
                if (title) {
                    await client.from('schedules').insert([{ user_id: userId, title: title, start_time: info.startStr, end_time: info.endStr, color_type: type }]);
                    calendar.refetchEvents();
                }
            }
            calendar.unselect();
        },
        events: async function(info, successCallback) {
            let query = client.from('schedules').select('*');
            if (role !== 'hr') query = query.eq('user_id', userId);
            const { data } = await query;
            successCallback(data ? data.map(e => ({ id: e.id, title: e.title, start: e.start_time, end: e.end_time, backgroundColor: e.color_type, borderColor: 'transparent' })) : []);
        }
    });
    calendar.render();
}

async function loadContents(type, containerId) {
    const { data, error } = await client.from('contents').select('*').eq('type', type).order('created_at', { ascending: false });
    if (error) return;
    const container = $(`#${containerId}`);
    container.empty();
    data.forEach(item => {
    const linkButton = sub.file_url ? `
        <a href="${sub.file_url}" target="_blank" class="block w-full py-2 bg-white/50 text-center rounded-lg text-xs hover:bg-white transition-all">
            <i class="fa-solid fa-link mr-1"></i> ดูลิงก์ที่ส่งไป
        </a>
    ` : `
        <div class="text-center py-2 text-[10px] text-gray-500 italic bg-black/5 rounded-lg">
            ส่งงานโดยไม่มีการแนบลิงก์
        </div>
    `;
        
        container.append(`
            <article class="card-thai bg-white overflow-hidden shadow-sm hover:shadow-md transition rounded-2xl border border-gray-100">
                <div class="h-48 bg-gray-200 rounded-2xl bg-cover bg-center" style="background-image: url('${item.image_url || 'https://t4.ftcdn.net/jpg/06/57/37/01/360_F_657370150_pdNeG5pjI976ZasVbKN9VqH1rfoykdYU.jpg'}')"></div>
                <div class="p-6">
                    <span class="text-[10px] font-bold text-red-700 uppercase tracking-widest">${item.type}</span>
                    <h3 class="font-bold text-lg mt-2 mb-3">${item.title}</h3>
                    <p class="text-sm text-gray-600 leading-relaxed line-clamp-3">${item.description}</p>
                    ${linkButton}
                </div>
            </article>`);
    });
}

function setupHRFeatures() {
    console.log("🛠️ Debug: setupHRFeatures() เริ่มต้นทำงาน");

    $('#hrContentPanel, #invitePanel, #hrAssignmentPanel').removeClass('hidden');

    $(document).off('submit', '#createTaskForm').on('submit', '#createTaskForm', async function(e) {
        e.preventDefault();
        console.log("📝 Debug: ตรวจพบการ Submit ฟอร์มสร้างงาน");

        const task = { 
            title: $('#taskTitle').val()?.trim(), 
            description: $('#taskDesc').val()?.trim(), 
            due_date: $('#taskDue').val() 
        };

        console.log("🔍 Debug: ข้อมูลที่จะส่งไป Supabase ->", task);

        if (!task.title || !task.due_date) {
            console.warn("⚠️ Debug: ข้อมูลไม่ครบ");
            return Swal.fire("ข้อมูลไม่ครบ", "กรุณาระบุหัวข้อและวันที่", "warning");
        }

        Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });

        try {
            const { data, error } = await client.from('assignments').insert([task]).select();
            
            if (error) {
                console.error("❌ Debug: Supabase Error ->", error);
                throw error;
            }

            console.log("✅ Debug: บันทึกสำเร็จ!", data);
            await Swal.fire('สำเร็จ', 'มอบหมายงานเรียบร้อยแล้ว', 'success'); 
            
            this.reset(); 
            closeCreateTaskModal();

            const currentPage = window.location.pathname.split("/").pop() || 'index.html';
            if (currentPage === 'assignments.html') {
                loadStream();
                loadClasswork();
            } else {
                loadAssignmentsListSimple();
            }

        } catch (err) {
            console.error("❌ Debug: เกิดข้อผิดพลาดร้ายแรง ->", err);
            Swal.fire('ล้มเหลว', err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ", 'error');
        }
    });

    $(document).off('submit', '#createInviteForm').on('submit', '#createInviteForm', async function(e) {
        e.preventDefault();
        const expireInput = $('#inviteExpire').val(); 
        if (!expireInput) return Swal.fire("กรุณาระบุเวลาหมดอายุ");

        try {
            const dateObj = new Date(expireInput);
            const offset = dateObj.getTimezoneOffset() * 60000;
            const localISO = new Date(dateObj.getTime() - offset).toISOString();
            const token = crypto.randomUUID().replaceAll('-', '');

            const { error } = await client.from("invites").insert({ token: token, expires_at: localISO });
            if (!error) {
                const link = window.location.origin + "/register.html?token=" + token;
                $('#inviteResult').html(`
                    <div class="mt-4 p-3 bg-green-50 border border-green-100 rounded-lg">
                        <p class="text-xs font-bold mb-1 text-green-600">สร้างลิงก์สำเร็จ!</p>
                        <input value="${link}" class="w-full border p-2 text-sm bg-white rounded" readonly onclick="this.select()">
                    </div>
                `);
            } else { throw error; }
        } catch (err) {
            Swal.fire("เกิดข้อผิดพลาด", err.message, "error");
        }
    });
}

async function initRegister() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) return;

    const { data: invite } = await client.from("invites").select("*").eq("token", token).single();
    if (!invite || invite.used || new Date(invite.expires_at).getTime() < new Date().getTime()) {
        return Swal.fire("ลิงก์หมดอายุหรือไม่ถูกต้อง");
    }

    $('#registerForm').submit(async function(e) {
        e.preventDefault();
        const username = $('#username').val().trim().toLowerCase();
        const pass = $('#password').val();
        
        if (pass !== $('#confirm').val()) return Swal.fire("รหัสผ่านไม่ตรงกัน");

        const permanentEmail = username + "@gmail.com"; 

        const { data, error } = await client.auth.signUp({ 
            email: permanentEmail, 
            password: pass 
        });

        if (error) return Swal.fire(error.message);

        await client.from("profiles").update({ 
            username: username, 
            email: permanentEmail, 
            role: "staff", 
            full_name: username 
        }).eq("id", data.user.id);

        await client.from("invites").update({ used: true, used_by: data.user.id }).eq("token", token);
        
        Swal.fire({ icon: "success", title: "สมัครสำเร็จ" }).then(() => { 
            window.location = "workshop.html"; 
        });
    });
}

async function updateNavbarUI(session) {
    const navAction = $('#navAction');
    const currentPage = window.location.pathname.split("/").pop() || 'index.html';
    const menuItems = [{ name: 'หน้าแรก', url: 'index.html' }, { name: 'เวิร์กชอป', url: 'workshop.html' }];
    $('#desktopNav').html(menuItems.map(item => `<a href="${item.url}" class="text-sm font-bold transition-colors ${currentPage === item.url ? 'text-[#721c24]' : 'text-gray-500 hover:text-[#721c24]'}">${item.name}</a>`).join(''));
    if (session) {
        const avatar = currentUser?.avatar_url || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png';
        navAction.html(`<div class="relative inline-block text-left"><button onclick="toggleDropdown()" class="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-xl transition-all border border-transparent hover:border-gray-100"><div class="text-right hidden md:block"><p class="text-xs font-bold text-gray-800 leading-none">${currentUser?.full_name || currentUser?.username}</p><p class="text-[10px] text-gray-400 uppercase mt-1 tracking-tighter">${currentUser?.role}</p></div><img src="${avatar}" class="w-10 h-10 rounded-full object-cover border-2 border-[#b38b59]/20 shadow-sm"></button><div id="profileDropdown" class="hidden absolute right-0 mt-3 w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-[1001] animate__animated animate__fadeInUp animate__faster"><button onclick="openProfileModal()" class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3">⚙️ ตั้งค่าโปรไฟล์</button><a href="workshop.html" class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3">📅 ตารางงานของฉัน</a><hr class="my-2 border-gray-50"><button id="logoutBtn" class="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3">🚪 ออกจากระบบ</button></div></div>`);
    } else {
        navAction.html(`<div class="flex items-center gap-3"><a href="login.html" class="hidden md:block text-sm font-bold text-gray-600 hover:text-[#721c24]">เข้าสู่ระบบ</a><a href="login.html" class="bg-[#721c24] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-red-900/20 hover:opacity-90 active:scale-95 transition-all">เริ่มใช้งาน</a></div>`);
    }
}

function toggleMobileMenu() { $('#mobileMenu').toggleClass('hidden'); }
function toggleDropdown() { $('#profileDropdown').toggleClass('hidden'); }
$(window).on('click', e => { if (!$(e.target).closest('#navAction').length) $('#profileDropdown').addClass('hidden'); });

function openProfileModal() {
    $('#profileDropdown').addClass('hidden');
    $('#profileModal').removeClass('hidden').css('display', 'flex');
    $('#editUsername').val(currentUser?.username || '');
    $('#editFullName').val(currentUser?.full_name || '');
    if (currentUser?.avatar_url) $('#profilePreview').attr('src', currentUser.avatar_url);
}

function closeProfileModal() { $('#profileModal').addClass('hidden').css('display', 'none'); }

$('#profileUpdateForm').submit(async function(e) {
    e.preventDefault();
    
    const newUsername = $('#editUsername').val().trim().toLowerCase();
    const newName = $('#editFullName').val().trim();
    const newPass = $('#newProfilePass').val(); 
    const avatarFile = $('#avatarInput')[0].files[0];

    closeProfileModal();

    Swal.fire({ 
        title: 'กำลังบันทึก...', 
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading() 
    });

    try {
        let avatarUrl = currentUser.avatar_url;

        if (avatarFile) {
            const fileName = `${currentUser.id}-${Date.now()}`;
            const { error: uploadError } = await client.storage.from('avatars').upload(fileName, avatarFile);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = client.storage.from('avatars').getPublicUrl(fileName);
            avatarUrl = publicUrl;
        }

        const { error: updateError } = await client.from('profiles')
            .update({ 
                full_name: newName, 
                username: newUsername, 
                avatar_url: avatarUrl 
            })
            .eq('id', currentUser.id);

        if (updateError) throw updateError;

        if (newPass && newPass.trim() !== "") {
            const { error: passError } = await client.auth.updateUser({ password: newPass });
            if (passError) throw passError;
        }

        Swal.fire({
            icon: 'success',
            title: 'สำเร็จ!',
            text: 'อัปเดตข้อมูลเรียบร้อยแล้ว',
            confirmButtonColor: '#721c24'
        }).then(() => { 
            location.reload(); 
        });

    } catch (err) {
        console.error("Update Error:", err);
        Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: err.message,
            confirmButtonColor: '#721c24'
        }).then(() => {
            $('#profileModal').removeClass('hidden');
        });
    }
});

$('#avatarInput').change(function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => $('#profilePreview').attr('src', e.target.result);
        reader.readAsDataURL(file);
    }
});
