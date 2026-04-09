const SUPABASE_URL = 'https://fucrcbuqbpnbftyljqgi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Y3JjYnVxYnBuYmZ0eWxqcWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzc1MTIsImV4cCI6MjA5MTI1MzUxMn0.XXKIgZ_9Ciciq3qfgINK48J70HbunRyP28p1MiIv6To';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

$(document).ready(async function() {
    const { data: { session } } = await client.auth.getSession();
    const currentPage = window.location.pathname.split("/").pop() || 'index.html';

    if (currentPage === 'login.html') {
        if (session) { window.location.href = 'workshop.html'; return; }
    } 
    else if (currentPage === 'workshop.html') {
        if (!session) { window.location.href = 'login.html'; return; }
        initWorkshop(session);
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
        try {
            const { data: profile } = await client.from('profiles').select('id').eq('username', userInput).single();
            if (!profile) {
                Swal.fire({ icon: 'warning', title: 'ไม่พบชื่อผู้ใช้งาน' });
                return;
            }
            const { error } = await client.auth.signInWithPassword({
                email: userInput + "@gmail.com",
                password: password
            });
            if (error) { Swal.fire({ icon: 'error', title: 'รหัสผ่านไม่ถูกต้อง' }); }
            else { window.location.href = 'workshop.html'; }
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
    const { data: profile, error } = await client.from('profiles').select('*').eq('id', session.user.id).single();
    if (error || !profile) return;

    $('#userDisplay').text("ผู้ใช้งาน: " + (profile.full_name || profile.username)).removeClass('hidden');

    if (profile.role === 'hr') {
        setupHRFeatures();
    }

    renderCalendar(profile.id, profile.role);
    loadAssignments();
    $('body').removeClass('hidden');
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
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,timeGridDay'
        },
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
            await client.from('schedules').update({
                start_time: info.event.startStr,
                end_time: info.event.endStr
            }).eq('id', info.event.id);
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
                    await client.from('schedules').insert([{
                        user_id: userId, title: title, start_time: info.startStr, end_time: info.endStr, color_type: type
                    }]);
                    calendar.refetchEvents();
                }
            }
            calendar.unselect();
        },
        events: async function(info, successCallback) {
            let query = client.from('schedules').select('*');
            if (role !== 'hr') query = query.eq('user_id', userId);
            const { data } = await query;
            successCallback(data ? data.map(e => ({
                id: e.id, title: e.title, start: e.start_time, end: e.end_time, backgroundColor: e.color_type, borderColor: 'transparent'
            })) : []);
        }
    });
    calendar.render();
}

async function loadAssignments() {
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
            <div class="p-4 border rounded-xl mb-3 bg-white shadow-sm">
                <div class="flex justify-between">
                    <h4 class="font-bold">${task.title}</h4>
                    <span class="text-xs text-red-500">DUE: ${new Date(task.due_date).toLocaleDateString('th-TH')}</span>
                </div>
                <p class="text-xs text-gray-500 mt-2">${task.description || '-'}</p>
            </div>
        `);
    });
}








async function loadContents(type, containerId) {
    const { data, error } = await client
        .from('contents')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: false });

    if (error) return;

    const container = $(`#${containerId}`);
    container.empty();

    data.forEach(item => {
    const linkButton = (item.link_url && item.link_url !== '#') 
        ? `<a href="${item.link_url}" class="mt-4 inline-block text-sm font-bold text-amber-700 hover:underline transition-all">เข้าชม →</a>` 
        : '';

    container.append(`
        <article class="card-thai bg-white overflow-hidden shadow-sm hover:shadow-md transition rounded-2xl border border-gray-100">
            <div class="h-48 bg-gray-200 bg-cover bg-center" style="background-image: url('${item.image_url || 'https://via.placeholder.com/400x200'}')"></div>
            <div class="p-6">
                <span class="text-[10px] font-bold text-red-700 uppercase tracking-widest">${item.type}</span>
                <h3 class="font-bold text-lg mt-2 mb-3">${item.title}</h3>
                <p class="text-sm text-gray-600 leading-relaxed line-clamp-3">${item.description}</p>
                ${linkButton}
            </div>
        </article>
    `);
});
}

async function addContent(formData) {
    const { error } = await client.from('contents').insert([formData]);
    if (!error) {
        Swal.fire('สำเร็จ!', 'เพิ่มเนื้อหาเรียบร้อยแล้ว', 'success');
        location.reload();
    }
}







function setupHRFeatures() {
    $('#hrContentPanel').removeClass('hidden');
    $('#invitePanel, #hrAssignmentPanel').removeClass('hidden');
   $('#createInviteForm').off('submit').on('submit', async function(e) {
        e.preventDefault();
        const expireInput = $('#inviteExpire').val(); 
        if (!expireInput) return Swal.fire("กรุณาระบุเวลาหมดอายุ");
    
        const dateObj = new Date(expireInput);
        const offset = dateObj.getTimezoneOffset() * 60000;
        const localISO = new Date(dateObj.getTime() - offset).toISOString();
    
        const token = crypto.randomUUID().replaceAll('-', '');
        
        const { error } = await client.from("invites").insert({ 
            token: token, 
            expires_at: localISO 
        });
    
        if (!error) {
            const link = window.location.origin + "/register.html?token=" + token;
            $('#inviteResult').html(`
                <p class="text-xs font-bold mb-1 text-green-600">สร้างลิงก์สำเร็จ!</p>
                <input value="${link}" class="w-full border p-2 text-sm bg-gray-50 rounded" readonly onclick="this.select()">
                <p class="text-[10px] text-gray-400 mt-1">*หมดอายุ: ${new Date(expireInput).toLocaleString('th-TH')}</p>
            `);
        } else {
            Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถสร้างลิงก์ได้", "error");
        }
    });

    $('#createTaskForm').off('submit').on('submit', async function(e) {
        e.preventDefault();
        const task = { title: $('#taskTitle').val(), description: $('#taskDesc').val(), due_date: $('#taskDue').val() };
        const { error } = await client.from('assignments').insert([task]);
        if (!error) { Swal.fire('สำเร็จ', 'มอบหมายงานแล้ว', 'success'); this.reset(); loadAssignments(); }
    });    
    $('#addContentForm').off('submit').on('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            type: $('#contentType').val(),
            title: $('#contentTitle').val().trim(),
            description: $('#contentDesc').val().trim(),
            image_url: $('#contentImage').val().trim(),
            link_url: $('#contentLink').val().trim()
        };

        if (!formData.title || !formData.description) {
            return Swal.fire("กรุณากรอกข้อมูลให้ครบถ้วน");
        }

        Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });

        const { error } = await client.from('contents').insert([formData]);

        if (!error) {
            await Swal.fire('สำเร็จ!', 'เพิ่มเนื้อหาเรียบร้อยแล้ว', 'success');
            this.reset(); 
            location.reload(); 
        } else {
            console.error(error);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้: ' + error.message, 'error');
        }
    });
}


async function initRegister() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) { Swal.fire("ลิงก์ไม่ถูกต้อง"); return; }

    
   const { data: invite } = await client.from("invites").select("*").eq("token", token).single();

    if (!invite) {
        Swal.fire("ไม่พบลิงก์นี้ในระบบ");
        return;
    }
    
    const expireDate = new Date(invite.expires_at); 
    
    const currentDate = new Date();
    
    const expireTimestamp = expireDate.getTime();
    const currentTimestamp = currentDate.getTime();
    
    console.log("Expire (Local):", expireDate.toLocaleString('th-TH'));
    console.log("Current (Local):", currentDate.toLocaleString('th-TH'));
    console.log("Diff (Sec):", (expireTimestamp - currentTimestamp) / 1000);
    

    if (invite.used || expireTimestamp < currentTimestamp) {
        Swal.fire({
            icon: 'error',
            title: 'ลิงก์หมดอายุ',
            text: `ลิงก์นี้หมดอายุแล้วเมื่อ: ${expireDate.toLocaleString('th-TH')}`
        }); 
        return;
    }



    $('#registerForm').submit(async function(e) {
        e.preventDefault();
        const username = $('#username').val().trim().toLowerCase();
        const pass = $('#password').val();
        if (pass !== $('#confirm').val()) { Swal.fire("รหัสผ่านไม่ตรงกัน"); return; }

        Swal.fire({ title: "กำลังสร้างบัญชี...", didOpen: () => Swal.showLoading() });
        const { data, error } = await client.auth.signUp({ email: username + "@gmail.com", password: pass });
        if (error) { Swal.fire(error.message); return; }

        await client.from("profiles").update({ username: username, role: "staff", full_name: username }).eq("id", data.user.id);
        await client.from("invites").update({ used: true, used_by: data.user.id }).eq("token", token);

        Swal.fire({ icon: "success", title: "สมัครสำเร็จ" }).then(() => { window.location = "workshop.html"; });
    });
}

async function updateNavbarUI(session) {
    const navAction = $('#navAction');
    const mobileMenu = $('#mobileMenu');
    const currentPage = window.location.pathname.split("/").pop() || 'index.html';

    const menuItems = [
        { name: 'หน้าแรก', url: 'index.html' },
        { name: 'เวิร์กชอป', url: 'workshop.html' },
    ];

    const navLinksHTML = menuItems.map(item => `
        <a href="${item.url}" class="text-sm font-bold transition-colors ${currentPage === item.url ? 'text-[#721c24]' : 'text-gray-500 hover:text-[#721c24]'}">
            ${item.name}
        </a>
    `).join('');
    
    $('#desktopNav').html(navLinksHTML);

    $('#mobileMenuLinks').html(menuItems.map(item => `
        <a href="${item.url}" class="block text-sm font-bold py-2 ${currentPage === item.url ? 'text-[#721c24]' : 'text-gray-600'}">
            ${item.name}
        </a>
    `).join(''));

    if (session) {
        const { data: profile } = await client.from('profiles').select('*').eq('id', session.user.id).single();
        const avatar = profile?.avatar_url || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png';
        const name = profile?.full_name || profile?.username || 'ผู้ใช้งาน';
        const role = profile?.role === 'hr' ? 'Tech Management' : 'Staff';

        navAction.html(`
            <div class="relative inline-block text-left">
                <button onclick="toggleDropdown()" class="flex items-center gap-3 hover:bg-gray-50 p-1.5 md:p-2 rounded-xl transition-all border border-transparent hover:border-gray-100">
                    <div class="text-right hidden md:block">
                        <p class="text-xs font-bold text-gray-800 leading-none">${name}</p>
                        <p class="text-[10px] text-gray-400 uppercase mt-1 tracking-tighter">${role}</p>
                    </div>
                    <img src="${avatar}" class="w-10 h-10 rounded-full object-cover border-2 border-[#b38b59]/20 shadow-sm">
                </button>

                <div id="profileDropdown" class="hidden absolute right-0 mt-3 w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-[1001] animate__animated animate__fadeInUp animate__faster">
                    <div class="px-4 py-2 border-b border-gray-50 mb-2">
                         <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">จัดการบัญชี</p>
                    </div>
                    
                    <button onclick="openProfileModal()" class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3">
                        <span class="text-blue-500">⚙️</span> ตั้งค่าโปรไฟล์
                    </button>
                    
                    <a href="workshop.html" class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3">
                        <span class="text-purple-500">📅</span> ตารางงานของฉัน
                    </a>

                    <hr class="my-2 border-gray-50">
                    
                    <button id="logoutBtn" class="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3">
                        <span>🚪</span> ออกจากระบบ
                    </button>
                </div>
            </div>
        `);
    } else {
        navAction.html(`
            <div class="flex items-center gap-3">
                <a href="login.html" class="hidden md:block text-sm font-bold text-gray-600 hover:text-[#721c24]">เข้าสู่ระบบ</a>
                <a href="login.html" class="bg-[#721c24] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-red-900/20 hover:opacity-90 active:scale-95 transition-all">
                    เริ่มใช้งาน
                </a>
            </div>
        `);
    }
}

function toggleMobileMenu() {
    $('#mobileMenu').toggleClass('hidden');
}



function toggleDropdown() {
    $('#profileDropdown').toggleClass('hidden');
}

$(window).on('click', function(e) {
    if (!$(e.target).closest('#navAction').length) {
        $('#profileDropdown').addClass('hidden');
    }
});

function openProfileModal() {
    $('#profileDropdown').addClass('hidden');
    $('#profileModal').removeClass('hidden').css('display', 'flex');
    client.auth.getUser().then(async ({ data: { user } }) => {
        const { data: profile } = await client.from('profiles').select('*').eq('id', user.id).single();
        if (profile) {
            $('#editUsername').val(profile.username || '');
            $('#editFullName').val(profile.full_name || '');
            if (profile.avatar_url) $('#profilePreview').attr('src', profile.avatar_url);
        }
    });
}

function closeProfileModal() {
    $('#profileModal').addClass('hidden').css('display', 'none');
}

$('#profileUpdateForm').submit(async function(e) {
    e.preventDefault();
    const newUsername = $('#editUsername').val().trim().toLowerCase();
    const newName = $('#editFullName').val().trim();
    const newPass = $('#newProfilePass').val();
    const avatarFile = $('#avatarInput')[0].files[0];

    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });

    try {
        const { data: { user } } = await client.auth.getUser();
        let avatarUrl = $('#profilePreview').attr('src');

        if (avatarFile) {
            const fileName = `${user.id}-${Date.now()}`;
            const { error: uploadError } = await client.storage.from('avatars').upload(fileName, avatarFile);
            if (!uploadError) {
                const { data: { publicUrl } } = client.storage.from('avatars').getPublicUrl(fileName);
                avatarUrl = publicUrl;
            }
        }

        const updateData = { full_name: newName, avatar_url: avatarUrl };
        if (newUsername) updateData.username = newUsername;

        const { error: updateError } = await client.from('profiles').update(updateData).eq('id', user.id);
        if (updateError) throw updateError;

        if (newPass) {
            if (newPass.length < 6) throw new Error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
            await client.auth.updateUser({ password: newPass });
        }

        Swal.fire('สำเร็จ!', 'อัปเดตข้อมูลเรียบร้อย', 'success').then(() => { location.reload(); });
    } catch (err) {
        Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
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
