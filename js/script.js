const SUPABASE_URL = 'https://fucrcbuqbpnbftyljqgi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Y3JjYnVxYnBuYmZ0eWxqcWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzc1MTIsImV4cCI6MjA5MTI1MzUxMn0.XXKIgZ_9Ciciq3qfgINK48J70HbunRyP28p1MiIv6To';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

$(document).ready(function() {
    console.log("🚀 System: Login script initialized.");

    $('#loginForm').submit(async (e) => {
        e.preventDefault();
        
        const userInput = $('#username').val().trim();
        const password = $('#password').val();

        console.log(`🔍 Debug 1: Searching for user: ${userInput}`);

        try {
            // STEP 1: ค้นหา Profile
            const { data: profile, error: findError } = await client
                .from('profiles')
                .select('id')
                .eq('username', userInput)
                .single();

            if (findError) {
                console.error("❌ Debug 1 Error:", findError.message);
                console.error("Full Error Object:", findError);
                
                let errorMsg = 'กรุณาตรวจสอบชื่อผู้ใช้งานอีกครั้ง';
                if (findError.code === 'PGRST116') errorMsg = 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ';
                if (findError.code === '42501') errorMsg = 'ระบบถูกล็อค (RLS Error): โปรดติดต่อผู้ดูแลให้เปิดสิทธิ์ Select';

                Swal.fire({ icon: 'error', title: 'ไม่พบผู้ใช้งาน', text: errorMsg });
                return;
            }

            console.log("✅ Debug 1 Success: Found Profile ID:", profile.id);

            // STEP 2: พยายาม Login
            const email = userInput + "@gmail.com"; 
            console.log(`🔐 Debug 2: Attempting Auth with: ${email}`);

            const { data: authData, error: loginError } = await client.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (loginError) {
                console.error("❌ Debug 2 Error:", loginError.message);
                Swal.fire({
                    icon: 'error',
                    title: 'เข้าสู่ระบบไม่สำเร็จ',
                    text: `สาเหตุ: ${loginError.message}`
                });
            } else {
                console.log("🎉 Debug 2 Success: Login Granted!");
                window.location.href = 'workshop.html';
            }
            
        } catch (err) {
            console.error('💥 Critical System Error:', err);
            Swal.fire('เกิดข้อผิดพลาด', 'เกิดปัญหาที่ระบบฝั่ง Client', 'error');
        }
    });
});
