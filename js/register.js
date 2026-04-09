const SUPABASE_URL = 'YOUR_URL';

const SUPABASE_KEY = 'YOUR_KEY';

const client =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

function deviceHash() {

    return btoa(

        navigator.userAgent +
        screen.width +
        screen.height +
        Intl.DateTimeFormat().resolvedOptions().timeZone

    );

}

$(document).ready(async function () {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const token =
        params.get("token");

    if (!token) {

        Swal.fire(
            "invalid link"
        );

        return;

    }

    const { data: invite } =
        await client
            .from("invites")
            .select("*")
            .eq("token", token)
            .single();

    if (!invite) {

        Swal.fire(
            "invalid invite"
        );

        return;

    }

    if (invite.used) {

        Swal.fire(
            "invite used"
        );

        return;

    }

    if (
        new Date(invite.expires_at)
        <
        new Date()
    ) {

        Swal.fire(
            "invite expired"
        );

        return;

    }

    $('#registerForm').submit(
        async function (e) {

            e.preventDefault();

            const email =
                $('#email').val();

            const username =
                $('#username').val();

            const pass =
                $('#password').val();

            const confirm =
                $('#confirm').val();

            if (pass !== confirm) {

                Swal.fire(
                    "password mismatch"
                );

                return;

            }

            const device =
                deviceHash();

            const { data, error } =
                await client.auth.signUp({

                    email: email,

                    password: pass

                });

            if (error) {

                Swal.fire(
                    error.message
                );

                return;

            }

            await client
                .from("profiles")
                .update({

                    username: username,

                    role: "staff",

                    full_name: username

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

                    used: true,

                    used_by:
                        data.user.id,

                    device_id:
                        device

                })
                .eq(
                    "token",
                    token
                );

            window.location =
                "workshop.html";

        });

});
