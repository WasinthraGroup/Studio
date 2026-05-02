const SUPABASE_URL = 'https://fucrcbuqbpnbftyljqgi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Y3JjYnVxYnBuYmZ0eWxqcWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzc1MTIsImV4cCI6MjA5MTI1MzUxMn0.XXKIgZ_9Ciciq3qfgINK48J70HbunRyP28p1MiIv6To';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;
let activeTaskId = null;

$(document).ready(async function() {
    const { data: { session } } = await client.auth.getSession();
    const currentPage = window.location.pathname.split("/").pop() || 'index.html';

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
        const userInput = $('#username').val().trim();
        const password = $('#password').val();
        if (!userInput || !password) {
            Swal.fire({ icon: 'info', title: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
            return;
        }
        Swal.fire({ title: 'กำลังเข้าสู่ระบบ...', didOpen: () => Swal.showLoading() });
        try {
            let loginEmail = userInput.includes('@') ? userInput : userInput + "@gmail.com";
            const { error: authError } = await client.auth.signInWithPassword({
                email: loginEmail,
                password: password
            });
            if (authError) {
                Swal.fire({ icon: 'error', title: 'เข้าสู่ระบบไม่สำเร็จ', text: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
            } else {
                window.location.href = 'workshop.html';
            }
        } catch (err) {
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
                            <p class="text-xs font-bold">`${currentUser?.full_name ? 'โพสต์ใหม่ของ ' + currentUser.full_name + ': ' : 'โพสต์ใหม่: '}`</p>
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
    const { data: tasks } = await client.from('assignments').select('*').order('due_date', { ascending: true });
    const list = $('#classworkList').empty();
    list.append(`<h2 class="text-[#721c24] text-xl font-bold border-b pb-2 mb-4">งานทั้งหมด</h2>`);
    tasks.forEach(t => {
        list.append(`
            <div onclick="openTaskModal('${t.id}')" class="assignment-card bg-white border-b p-4 flex justify-between items-center cursor-pointer transition hover:bg-gray-50">
                <div class="flex items-center gap-4">
                    <i class="fa-solid fa-file-lines text-gray-400"></i>
                    <span class="font-medium">${t.title}</span>
                </div>
                <span class="text-xs text-gray-400">กำหนดส่ง ${new Date(t.due_date).toLocaleDateString('th-TH')}</span>
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
    const { data: task } = await client.from('assignments').select('*').eq('id', id).single();
    const { data: sub } = await client.from('student_assignments').select('*').eq('assignment_id', id).eq('user_id', currentUser.id).single();
    
    $('#mTaskTitle').text(task.title);
    
    $('#mTaskDesc').html(urlToLink(task.description));
    
    $('#mTaskDue').text(new Date(task.due_date).toLocaleDateString('th-TH'));
    $('#taskModal').removeClass('hidden');
    renderStatus(sub);
    loadComments();
}

function renderStatus(sub) {
    const badge = $('#modalStatus');
    badge.removeClass('bg-blue-100 text-blue-600 bg-green-100 text-green-600');
    if (!sub) {
        badge.text('Assigned').addClass('bg-blue-100 text-blue-600');
        $('#workUrl').val('').attr('disabled', false);
        $('#submitBtn').text('ส่งงาน').attr('onclick', 'submitWork()').removeClass('bg-gray-500').addClass('bg-[#721c24]');
    } else {
        badge.text('Turned in').addClass('bg-green-100 text-green-600');
        $('#workUrl').val(sub.submission_url).attr('disabled', true);
        $('#submitBtn').text('ยกเลิกการส่ง').attr('onclick', 'unsubmitWork()').removeClass('bg-[#721c24]').addClass('bg-gray-500');
    }
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

async function submitWork() {
    const url = $('#workUrl').val();
    // if (!url) return Swal.fire('ลืมใส่ลิงก์!', 'กรุณาแนบลิงก์งานก่อนส่ง', 'warning');
    await client.from('student_assignments').upsert({
        assignment_id: activeTaskId,
        user_id: currentUser.id,
        submission_url: url || "",
        status: 'submitted'
    });
    Swal.fire('ส่งงานสำเร็จ!', '', 'success');
    openTaskModal(activeTaskId);
}

async function unsubmitWork() {
    const { isConfirmed } = await Swal.fire({
        title: 'ยกเลิกการส่งงาน?',
        text: "คุณต้องการยกเลิกการส่งงานเพื่อแก้ไขใช่หรือไม่?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ใช่, ยกเลิกการส่ง'
    });
    if (isConfirmed) {
        await client.from('student_assignments').delete().eq('assignment_id', activeTaskId).eq('user_id', currentUser.id);
        openTaskModal(activeTaskId);
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

function closeTaskModal() { $('#taskModal').addClass('hidden'); }

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
        const linkButton = (item.link_url && item.link_url !== '#') ? `<a target="_blank" href="${item.link_url}" class="mt-4 inline-block text-sm font-bold text-amber-700 hover:underline transition-all">เข้าชม →</a>` : '';
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

    // แสดงแผงควบคุมสำหรับ HR
    $('#hrContentPanel, #invitePanel, #hrAssignmentPanel').removeClass('hidden');

    // --- สร้างงาน (ใช้ Delegation เพื่อกัน Silent Error) ---
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
            
            this.reset(); // ล้างฟอร์ม
            closeCreateTaskModal(); // ปิด Modal

            // อัปเดตรายการงานทันทีโดยไม่ต้อง Refresh หน้า
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

    // --- สร้าง Invite ---
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
    if (!invite || invite.used || new Date(invite.expires_at).getTime() < new Date().getTime()) return Swal.fire("ลิงก์หมดอายุหรือไมถูกต้อง");
    $('#registerForm').submit(async function(e) {
        e.preventDefault();
        const username = $('#username').val().trim().toLowerCase();
        const pass = $('#password').val();
        if (pass !== $('#confirm').val()) return Swal.fire("รหัสผ่านไม่ตรงกัน");
        const { data, error } = await client.auth.signUp({ email: username + "@gmail.com", password: pass });
        if (error) return Swal.fire(error.message);
        await client.from("profiles").update({ username: username, role: "staff", full_name: username }).eq("id", data.user.id);
        await client.from("invites").update({ used: true, used_by: data.user.id }).eq("token", token);
        Swal.fire({ icon: "success", title: "สมัครสำเร็จ" }).then(() => { window.location = "workshop.html"; });
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
    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        let avatarUrl = currentUser.avatar_url;
        if (avatarFile) {
            const fileName = `${currentUser.id}-${Date.now()}`;
            const { error: uploadError } = await client.storage.from('avatars').upload(fileName, avatarFile);
            if (!uploadError) {
                const { data: { publicUrl } } = client.storage.from('avatars').getPublicUrl(fileName);
                avatarUrl = publicUrl;
            }
        }
        const { error: updateError } = await client.from('profiles').update({ full_name: newName, username: newUsername, avatar_url: avatarUrl }).eq('id', currentUser.id);
        if (updateError) throw updateError;
        if (newPass) await client.auth.updateUser({ password: newPass });
        Swal.fire('สำเร็จ!', 'อัปเดตข้อมูลเรียบร้อย', 'success').then(() => { location.reload(); });
    } catch (err) { Swal.fire('เกิดข้อผิดพลาด', err.message, 'error'); }
});

$('#avatarInput').change(function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => $('#profilePreview').attr('src', e.target.result);
        reader.readAsDataURL(file);
    }
});
