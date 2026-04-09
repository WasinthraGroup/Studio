const SUPABASE_URL =
'https://fucrcbuqbpnbftyljqgi.supabase.co';

const SUPABASE_KEY =
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Y3JjYnVxYnBuYmZ0eWxqcWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzc1MTIsImV4cCI6MjA5MTI1MzUxMn0.XXKIgZ_9Ciciq3qfgINK48J70HbunRyP28p1MiIv6To';

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
Intl.DateTimeFormat()
.resolvedOptions()
.timeZone

);

}

$(document).ready(
async function(){

const params =
new URLSearchParams(
window.location.search
);

const token =
params.get("token");

if(!token){

Swal.fire({

icon:"error",

title:"ลิงค์ไม่ถูกต้อง"

});

return;

}

const {data:invite,error:inviteError} =
await client
.from("invites")
.select("*")
.eq("token",token)
.single();

if(inviteError || !invite){

Swal.fire({

icon:"error",

title:"invite ไม่ถูกต้อง"

});

return;

}

if(invite.used){

Swal.fire({

icon:"error",

title:"ลิงค์ถูกใช้แล้ว"

});

return;

}

if(
new Date(invite.expires_at)
<
new Date()
){

Swal.fire({

icon:"error",

title:"ลิงค์หมดอายุ"

});

return;

}

$('#registerForm')
.submit(
async function(e){

e.preventDefault();

const email =
$('#email')
.val()
.trim();

const username =
$('#username')
.val()
.trim()
.toLowerCase();

const pass =
$('#password')
.val();

const confirm =
$('#confirm')
.val();

if(pass!==confirm){

Swal.fire({

icon:"warning",

title:"รหัสไม่ตรงกัน"

});

return;

}

const device =
deviceHash();

const {data:dev} =
await client
.from("devices")
.select("*")
.eq(
"device_hash",
device
)
.maybeSingle();

if(dev){

Swal.fire({

icon:"error",

title:"อุปกรณ์นี้มีบัญชีแล้ว",

text:"1 อุปกรณ์ใช้ได้ 1 บัญชีเท่านั้น"

});

return;

}

const {data:userCheck} =
await client
.from("profiles")
.select("username")
.eq(
"username",
username
)
.maybeSingle();

if(userCheck){

Swal.fire({

icon:"error",

title:"username ซ้ำ"

});

return;

}

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

Swal.fire({

icon:"error",

title:error.message

});

return;

}

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

await client
.from("devices")
.insert({

user_id:
data.user.id,

device_hash:
device

});

await client
.from("invites")
.update({

used:true,

used_by:
data.user.id,

device_id:
device

})
.eq(
"token",
token
);


Swal.fire({

icon:"success",

title:"สมัครสำเร็จ"

}).then(()=>{

window.location =
"workshop.html";

});

});

});
