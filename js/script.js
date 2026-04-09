// ตั้งค่า Supabase
const SUPABASE_URL = 'https://fucrcbuqbpnbftyljqgi.supabase.co';
// สำคัญ: ต้องใช้ค่า "anon public" ที่ขึ้นต้นด้วย eyJ... เท่านั้น
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Y3JjYnVxYnBuYmZ0eWxqcWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzc1MTIsImV4cCI6MjA5MTI1MzUxMn0.XXKIgZ_9Ciciq3qfgINK48J70HbunRyP28p1MiIv6To'; 
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

$(document).ready(function() {
    
    $('#loginForm').submit(async (e) => {
        e.preventDefault();
        
        const userInput = $('#username').val();
        const password = $('#password').val();

        try {
            // 1. ตรวจสอบว่ามี Username นี้ในตาราง profiles หรือไม่
            const { data: profile, error: findError } = await client
                .from('profiles')
                .select('id')
                .eq('username', userInput)
                .single();

            if (findError || !profile) {
                Swal.fire({
                    icon: 'error',
                    title: 'ไม่พบผู้ใช้งาน',
                    text: 'กรุณาตรวจสอบชื่อผู้ใช้งานอีกครั้ง'
                });
                return;
            }

            // 2. ทำการ Login (ใช้อีเมลจำลองที่สัมพันธ์กับตอนสมัคร)
            // หมายเหตุ: ตรง @yourcompany.com ต้องตรงกับที่คุณตั้งไว้ตอนเพิ่มพนักงาน
            const email = userInput + "@yourcompany.com"; 

            const { error: loginError } = await client.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (loginError) {
                Swal.fire({
                    icon: 'error',
                    title: 'ผิดพลาด',
                    text: 'รหัสผ่านไม่ถูกต้อง'
                });
            } else {
                window.location.href = 'workshop.html';
            }
            
        } catch (err) {
            console.error('System Error:', err);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
        }
    });

});
