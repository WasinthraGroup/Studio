const SUPABASE_URL = 'https://fucrcbuqbpnbftyljqgi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Y3JjYnVxYnBuYmZ0eWxqcWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzc1MTIsImV4cCI6MjA5MTI1MzUxMn0.XXKIgZ_9Ciciq3qfgINK48J70HbunRyP28p1MiIv6To';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

$(document).ready(function() {
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
});
