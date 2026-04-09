const SUPABASE_URL = 'https://fucrcbuqbpnbftyljqgi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Y3JjYnVxYnBuYmZ0eWxqcWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzc1MTIsImV4cCI6MjA5MTI1MzUxMn0.XXKIgZ_9Ciciq3qfgINK48J70HbunRyP28p1MiIv6To';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

$(document).ready(async function() {
    const { data: { session } } = await client.auth.getSession();
    const currentPage = window.location.pathname.split("/").pop();

    if (currentPage === 'login.html') {
        if (session) {
            window.location.href = 'workshop.html';
            return;
        }
    } else if (currentPage === 'workshop.html') {
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        initWorkshop(session);
    }

    updateNavbarUI(session);

    $('#loginForm').submit(async (e) => {
        e.preventDefault();
        const userInput = $('#username').val().trim();
        const password = $('#password').val();

        try {
            const { data: profile, error: findError } = await client
                .from('profiles')
                .select('id')
                .eq('username', userInput)
                .single();

            if (findError || !profile) {
                let errorMessage = 'ชื่อผู้ใช้งานไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
                if (findError && findError.code === '42501') {
                    errorMessage = 'ไม่สามารถเข้าถึงระบบได้ในขณะนี้ โปรดติดต่อผู้ดูแลระบบ';
                }
                Swal.fire({
                    icon: 'warning',
                    title: 'ข้อมูลไม่ถูกต้อง',
                    text: errorMessage,
                    confirmButtonText: 'ตกลง',
                    confirmButtonColor: '#d33'
                });
                return;
            }

            const email = userInput + "@gmail.com"; 
            const { error: loginError } = await client.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (loginError) {
                Swal.fire({
                    icon: 'error',
                    title: 'การเข้าสู่ระบบล้มเหลว',
                    text: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
                    confirmButtonText: 'ลองอีกครั้ง',
                    confirmButtonColor: '#d33'
                });
          } else {
            const { data: { session } } = await client.auth.getSession();
            const device = deviceHash();
            const { data: dev } = await client
                    .from("devices")
                    .select("*")
                    .eq(
                        "user_id",
                        session.user.id
                    )
                    .single();
            if (!dev) {
                await client
                    .from("devices")
                    .insert({
                        user_id:
                            session.user.id,
                        device_hash:
                            device
                    });
            } else {
                if (
                    dev.device_hash
                    !== device
                ) {
                    await client
                        .auth
                        .signOut();
                    Swal.fire({
                        icon: "error",
                        title: "ผิดพลาด",
                        text: "บัญชีนี้ใช้ได้เฉพาะอุปกรณ์ที่สมัคร"
                    });
                    return;
                }
            }
            window.location.href ='workshop.html';
        }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่ในภายหลัง',
                confirmButtonText: 'ตกลง'
            });
        }
    });

    $(document).on('click', '#logoutBtn', async () => {
        const { error } = await client.auth.signOut();
        if (!error) {
            window.location.href = 'index.html';
        }
    });
});

async function updateNavbarUI(session) {
    const isHome = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
    
    if (session) {
        let navHtml = `
            <div class="flex items-center gap-6">
                <a href="index.html" class="text-sm font-medium hover:text-red-700">หน้าหลัก</a>
                <a href="workshop.html" class="text-sm font-medium hover:text-red-700">เวิร์กชอป</a>
                <button id="logoutBtn" class="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-xs font-bold border border-red-200 hover:bg-red-100 transition-all">ออกจากระบบ</button>
            </div>
        `;
        $('#navAction').html(navHtml);
    } else if (isHome) {
        $('#navAction').html(`
            <a href="login.html" class="bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-red-800 transition-all shadow-md">เข้าสู่ระบบพนักงาน</a>
        `);
    }
}

async function initWorkshop(session) {
    const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('full_name, role, username, id')
        .eq('id', session.user.id)
        .single();

    if (profileError || !profile) return;

    $('#userDisplay').text(`ผู้ใช้งาน: ${profile.full_name}`).removeClass('hidden');

    if (profile.role === 'hr') {
        $('#hrMenu').removeClass('hidden');
        $('#hrAssignmentPanel').removeClass('hidden');
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
                title: 'จัดการกิจกรรม',
                text: `คุณต้องการลบกิจกรรม "${info.event.title}" ใช่หรือไม่?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'ลบกิจกรรม',
                cancelButtonText: 'ยกเลิก'
            });

            if (isConfirmed) {
                const { error } = await client
                    .from('schedules')
                    .delete()
                    .eq('id', info.event.id);

                if (!error) {
                    info.event.remove();
                    Swal.fire('ลบแล้ว', 'ลบกิจกรรมเรียบร้อย', 'success');
                } else {
                    Swal.fire('ผิดพลาด', 'ไม่สามารถลบได้', 'error');
                }
            }
        },

        eventChange: async function(info) {
            const updateData = {
                start_time: info.event.startStr,
                end_time: info.event.endStr
            };

            const { error } = await client
                .from('schedules')
                .update(updateData)
                .eq('id', info.event.id);

            if (error) {
                Swal.fire('ผิดพลาด', 'ไม่สามารถอัปเดตเวลาได้', 'error');
                info.revert(); 
            }
        },

        select: async function(info) {
            const { value: type } = await Swal.fire({
                title: 'เลือกประเภทกิจกรรม',
                input: 'radio',
                inputOptions: {
                    '#3b82f6': 'ทำงาน (สีฟ้า)',
                    '#f59e0b': 'ไม่ว่าง/ลางาน (สีเหลือง)'
                },
                inputValidator: (value) => { if (!value) return 'กรุณาเลือกหนึ่งอย่าง' }
            });

            if (type) {
                const { value: title } = await Swal.fire({
                    title: 'หัวข้อกิจกรรม',
                    input: 'text',
                    inputPlaceholder: 'ระบุหัวข้อ...',
                    showCancelButton: true
                });

                if (title) {
                    const eventData = {
                        user_id: userId,
                        title: title,
                        start_time: info.startStr,
                        end_time: info.endStr,
                        color_type: type
                    };
                    
                    const { data, error } = await client
                        .from('schedules')
                        .insert([eventData])
                        .select(); 

                    if (!error) {
                        calendar.refetchEvents();
                    }
                }
            }
            calendar.unselect();
        },

        events: async function(info, successCallback) {
            let query = client.from('schedules').select('*');
            if (role !== 'hr') {
                query = query.eq('user_id', userId);
            }
            const { data } = await query;
            const events = data ? data.map(e => ({
                id: e.id, 
                title: e.title,
                start: e.start_time,
                end: e.end_time,
                backgroundColor: e.color_type,
                borderColor: 'transparent'
            })) : [];
            successCallback(events);
        }
    });
    calendar.render();
}

async function loadAssignments() {
    const { data: assignments } = await client
        .from('assignments')
        .select('*')
        .order('due_date', { ascending: true });

    const taskContainer = $('#assignmentList');
    if (!taskContainer.length) return;
    taskContainer.empty();

    if (!assignments || assignments.length === 0) {
        taskContainer.append('<p class="text-gray-400 text-center py-10 italic text-sm">ไม่มีรายการงานในขณะนี้...</p>');
        return;
    }

    assignments.forEach(task => {
        taskContainer.append(`
            <div class="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition shadow-sm bg-white">
                <div class="flex justify-between items-start">
                    <h4 class="font-bold text-gray-800 text-sm">${task.title}</h4>
                    <span class="text-[10px] font-bold text-red-600 border border-red-100 px-2 py-0.5 rounded">
                        DUE: ${new Date(task.due_date).toLocaleDateString('th-TH')}
                    </span>
                </div>
                <p class="text-xs text-gray-500 mt-2 line-clamp-2">${task.description || '-'}</p>
                <div class="mt-3 pt-3 border-t flex justify-end">
                    <button class="text-xs font-bold text-blue-600 hover:text-blue-800 transition">ส่งงานเข้า Classroom</button>
                </div>
            </div>
        `);
    });
}

function setupHRFeatures() {

    $('#invitePanel').removeClass('hidden');
    $('#createInviteForm').off('submit').on('submit', async function (e) {
        e.preventDefault();
        const expire = $('#inviteExpire').val();
        const token = crypto.randomUUID().replaceAll('-', '');
        await client
            .from("invites")
            .insert({
                token: token,
                expires_at: expire
            });
        const link =
            window.location.origin +
            "/register.html?token=" + token;
        $('#inviteResult').html(`
    <div class="bg-gray-50 p-3 rounded">
    <p class="mb-2">ลิงค์:</p>
    <input
    value="${link}"
    class="w-full border p-2 text-xs"
    readonly>
    </div>
    `);
    });


    $('#createTaskForm').off('submit').on('submit', async function(e) {
        e.preventDefault();
        const taskData = {
            title: $('#taskTitle').val().trim(),
            description: $('#taskDesc').val().trim(),
            due_date: $('#taskDue').val()
        };

        const { error } = await client.from('assignments').insert([taskData]);
        if (error) {
            Swal.fire('ผิดพลาด', 'ไม่สามารถสั่งงานได้', 'error');
        } else {
            Swal.fire('สำเร็จ', 'มอบหมายงานเรียบร้อย', 'success');
            this.reset();
            loadAssignments();
        }
    });

    $('#addStaffForm').off('submit').on('submit', async function(e) {
        e.preventDefault();
        const fullName = $('#newStaffName').val().trim();
        const username = $('#newStaffUser').val().trim().toLowerCase();
        const password = $('#newStaffPass').val();
        const email = `${username}@gmail.com`;

        Swal.fire({ title: 'กำลังดำเนินการ', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const { data: authData, error: authError } = await client.auth.signUp({
            email: email,
            password: password
        });

        if (authError) {
            Swal.fire('เกิดข้อผิดพลาด', authError.message, 'error');
            return;
        }

        const { error: profileError } = await client
            .from('profiles')
            .update({ full_name: fullName, username: username, role: 'staff' })
            .eq('id', authData.user.id);

        if (profileError) {
            Swal.fire('ข้อควรระวัง', 'สร้างบัญชีสำเร็จ แต่การบันทึกโปรไฟล์มีปัญหา', 'warning');
        } else {
            Swal.fire({ icon: 'success', title: 'เพิ่มพนักงานสำเร็จ', confirmButtonColor: '#b43432' });
            this.reset();
        }
    });
}


function deviceHash(){
    return btoa(
    navigator.userAgent+
    screen.width+
    screen.height+
    Intl.DateTimeFormat().resolvedOptions().timeZone
    );
}
