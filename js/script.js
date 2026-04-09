const SUPABASE_URL =
'https://fucrcbuqbpnbftyljqgi.supabase.co';

const SUPABASE_KEY =
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmZ0eWxqcWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzc1MTIsImV4cCI6MjA5MTI1MzUxMn0.XXKIgZ_9Ciciq3qfgINK48J70HbunRyP28p1MiIv6To';

const client =
supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);

function deviceHash(){

return btoa(

navigator.userAgent+
screen.width+
screen.height+
Intl.DateTimeFormat().resolvedOptions().timeZone

);

}

$(document).ready(async function(){

const { data:{session} } =
await client.auth.getSession();

const currentPage =
window.location.pathname
.split("/")
.pop();


// LOGIN PAGE

if(currentPage==='login.html'){

if(session){

window.location.href='workshop.html';

return;

}

}


// WORKSHOP PAGE

else if(currentPage==='workshop.html'){

if(!session){

window.location.href='login.html';

return;

}

initWorkshop(session);

}


// REGISTER PAGE

else if(currentPage==='register.html'){

initRegister();

}


updateNavbarUI(session);


// LOGIN

$('#loginForm').submit(
async (e)=>{

e.preventDefault();

const userInput =
$('#username').val().trim();

const password =
$('#password').val();

try{

const {data:profile} =
await client
.from('profiles')
.select('id')
.eq('username',userInput)
.single();

if(!profile){

Swal.fire({

icon:'warning',

title:'ข้อมูลไม่ถูกต้อง',

text:'ไม่พบ username'

});

return;

}

const email =
userInput+"@gmail.com";

const {error} =
await client.auth
.signInWithPassword({

email:email,

password:password

});

if(error){

Swal.fire({

icon:'error',

title:'เข้าสู่ระบบล้มเหลว'

});

return;

}

window.location.href=
'workshop.html';

}catch{

Swal.fire({

icon:'error',

title:'ระบบมีปัญหา'

});

}

});


// LOGOUT

$(document).on(
'click',
'#logoutBtn',
async ()=>{

await client.auth.signOut();

window.location.href=
'index.html';

});

});


// REGISTER SYSTEM

async function initRegister(){

const params =
new URLSearchParams(
window.location.search
);

const token =
params.get("token");

if(!token){

Swal.fire(
"invalid link"
);

return;

}

const {data:invite} =
await client
.from("invites")
.select("*")
.eq("token",token)
.single();

if(!invite){

Swal.fire(
"invalid invite"
);

return;

}

if(invite.used){

Swal.fire(
"invite used"
);

return;

}

if(
new Date(invite.expires_at)
<
new Date()
){

Swal.fire(
"invite expired"
);

return;

}


$('#registerForm')
.submit(
async function(e){

e.preventDefault();

const email =
$('#email').val().trim();

const username =
$('#username')
.val()
.trim()
.toLowerCase();

const pass =
$('#password').val();

const confirm =
$('#confirm').val();

if(pass!==confirm){

Swal.fire(
"password mismatch"
);

return;

}


// CHECK USERNAME

const {data:userCheck} =
await client
.from("profiles")
.select("username")
.eq("username",username)
.maybeSingle();

if(userCheck){

Swal.fire(
"username ซ้ำ"
);

return;

}


// CREATE USER

Swal.fire({

title:"กำลังสร้างบัญชี",

allowOutsideClick:false,

didOpen:()=>{
Swal.showLoading();
}

});

const {data,error} =
await client.auth.signUp({

email:email,

password:pass

});

if(error){

Swal.fire(
error.message
);

return;

}


// UPDATE PROFILE

await client
.from("profiles")
.update({

username:username,

role:"staff",

full_name:username

})
.eq(
"id",
data.user.id
);


// MARK INVITE

await client
.from("invites")
.update({

used:true,

used_by:
data.user.id

})
.eq(
"token",
token
);


Swal.fire({

icon:"success",

title:"สมัครสำเร็จ"

}).then(()=>{

window.location=
"workshop.html";

});

});

}


// NAVBAR

async function updateNavbarUI(session){

const isHome =
window.location.pathname
.endsWith('index.html') ||
window.location.pathname.endsWith('/');

if(session){

$('#navAction').html(`

<div class="flex gap-6">

<a href="index.html">

หน้าหลัก

</a>

<a href="workshop.html">

เวิร์กชอป

</a>

<button id="logoutBtn">

ออกจากระบบ

</button>

</div>

`);

}

else if(isHome){

$('#navAction').html(`

<a href="login.html">

เข้าสู่ระบบ

</a>

`);

}

}


// WORKSHOP

async function initWorkshop(session){

const {data:profile} =
await client
.from('profiles')
.select('*')
.eq('id',
session.user.id)
.single();

if(!profile)
return;

$('#userDisplay')
.text(
"ผู้ใช้งาน: "+
profile.full_name
)
.removeClass('hidden');

if(profile.role==='hr'){

$('#hrAssignmentPanel')
.removeClass('hidden');

setupHRFeatures();

}

renderCalendar(
profile.id,
profile.role
);

loadAssignments();

$('body')
.removeClass('hidden');

}


// HR

function setupHRFeatures(){

$('#invitePanel')
.removeClass('hidden');

$('#createInviteForm')
.off('submit')
.on('submit',
async function(e){

e.preventDefault();

const expire =
$('#inviteExpire').val();

const token =
crypto.randomUUID()
.replaceAll('-','');

await client
.from("invites")
.insert({

token:token,

expires_at:expire

});

const link =

window.location.origin+

"/register.html?token="+
token;

$('#inviteResult')
.html(`

<input
value="${link}"
class="w-full border p-2"
readonly>

`);

});

}
