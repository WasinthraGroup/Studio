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
                window.location.href = 'workshop.html';
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
    if (session && (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/'))) {
        $('#navAction').html(`
            <div class="flex items-center gap-4">
                <a href="workshop.html" class="text-sm font-bold text-amber-800">ไปหน้า Workshop</a>
                <button id="logoutBtn" class="btn-thai px-4 py-2 rounded-lg text-xs transition-all">ออกจากระบบ</button>
            </div>
        `);
    }
}

async function initWorkshop(session) {
    const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('full_name, role, username')
        .eq('id', session.user.id)
        .single();

    if (profileError || !profile) return;

    $('#userDisplay').text(`ผู้ใช้งาน: ${profile.full_name}`);

    if (profile.role === 'hr') {
        $('#mainContent').removeClass('md:col-span-3').addClass('md:col-span-2');
        $('#hrMenu').removeClass('hidden');
        setupHRFeatures();
    }

    loadAssignments();
    $('body').removeClass('hidden');
}

async function loadAssignments() {
    const { data: assignments } = await client
        .from('assignments')
        .select('*')
        .order('due_date', { ascending: true });

    const taskContainer = $('#taskList');
    taskContainer.empty();

    if (!assignments || assignments.length === 0) {
        taskContainer.append('<p class="text-gray-400 italic">ไม่มีรายการงานในขณะนี้...</p>');
        return;
    }

    assignments.forEach(task => {
        taskContainer.append(`
            <div class="p-4 border-l-4 border-amber-400 bg-gray-50 rounded-r-lg hover:shadow-md transition duration-300">
                <div class="flex justify-between items-start">
                    <h4 class="font-bold text-gray-800">${task.title}</h4>
                    <span class="text-[10px] bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold uppercase">
                        ${new Date(task.due_date).toLocaleDateString('th-TH')}
                    </span>
                </div>
                <p class="text-sm text-gray-600 mt-1">${task.description || '-'}</p>
            </div>
        `);
    });
}

function setupHRFeatures() {
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
