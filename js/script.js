const SUPABASE_URL = 'https://fucrcbuqbpnbftyljqgi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Y3JjYnVxYnBuYmZ0eWxqcWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzc1MTIsImV4cCI6MjA5MTI1MzUxMn0.XXKIgZ_9Ciciq3qfgINK48J70HbunRyP28p1MiIv6To';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

$(document).ready(async function() {
    const { data: { session } } = await client.auth.getSession();
    const currentPage = window.location.pathname.split("/").pop();

    if (currentPage === 'login.html') {
        if (session) { window.location.href = 'workshop.html'; return; }
    } else if (currentPage === 'workshop.html') {
        if (!session) { window.location.href = 'login.html'; return; }
        initWorkshop(session);
    } else if (currentPage === 'register.html') {
        initRegister();
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

async function initRegister() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) { Swal.fire("ลิงก์ไม่ถูกต้อง"); return; }

    const { data: invite } = await client.from("invites").select("*").eq("token", token).single();

    if (!invite || invite.used || new Date(invite.expires_at) < new Date()) {
        Swal.fire("ลิงก์หมดอายุหรือถูกใช้ไปแล้ว");
        return;
    }

    $('#registerForm').submit(async function(e) {
        e.preventDefault();
        const username = $('#username').val().trim().toLowerCase();
        const pass = $('#password').val();
        if (pass !== $('#confirm').val()) { Swal.fire("รหัสผ่านไม่ตรงกัน"); return; }

        Swal.fire({ title: "กำลังสร้างบัญชี...", didOpen: () => Swal.showLoading() });

        const { data, error } = await client.auth.signUp({
            email: username + "@gmail.com",
            password: pass
        });

        if (error) { Swal.fire(error.message); return; }

        await client.from("profiles").update({ username: username, role: "staff", full_name: username }).eq("id", data.user.id);
        await client.from("invites").update({ used: true, used_by: data.user.id }).eq("token", token);

        Swal.fire({ icon: "success", title: "สมัครสำเร็จ" }).then(() => { window.location = "workshop.html"; });
    });
}

function setupHRFeatures() {
    $('#invitePanel').removeClass('hidden');
    $('#createInviteForm').off('submit').on('submit', async function(e) {
        e.preventDefault();
        const expire = $('#inviteExpire').val();
        const token = crypto.randomUUID().replaceAll('-', '');

        const { error } = await client.from("invites").insert({ token: token, expires_at: expire });

        if (!error) {
            const link = window.location.origin + "/register.html?token=" + token;
            $('#inviteResult').html(`
                <p class="text-xs font-bold mb-1">ส่งลิงก์นี้ให้พนักงาน:</p>
                <input value="${link}" class="w-full border p-2 text-sm bg-gray-50" readonly onclick="this.select()">
            `);
        }
    });
}

async function initWorkshop(session) {
    const { data: profile } = await client.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    $('#userDisplay').text("ผู้ใช้งาน: " + profile.full_name).removeClass('hidden');
    if (profile.role === 'hr') {
        $('#hrAssignmentPanel').removeClass('hidden');
        setupHRFeatures();
    }
    renderCalendar(profile.id, profile.role);
    loadAssignments();
    $('body').removeClass('hidden');
}

async function updateNavbarUI(session) {
    const isHome = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
    if (session) {
        $('#navAction').html(`<div class="flex gap-4"><a href="workshop.html">หน้าเวิร์กชอป</a><button id="logoutBtn" class="text-red-600">ออกจากระบบ</button></div>`);
    } else if (isHome) {
        $('#navAction').html(`<a href="login.html" class="btn-thai">เข้าสู่ระบบ</a>`);
    }
}
