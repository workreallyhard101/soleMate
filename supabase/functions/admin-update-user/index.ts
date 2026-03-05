import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log("Function called");

    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization");

    console.log("Authorization header present:", !!authHeader);

    if (!authHeader) {
      console.log("Missing authorization header");
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log("Env check", {
      hasUrl: !!SUPABASE_URL,
      hasAnon: !!SUPABASE_ANON_KEY,
      hasService: !!SERVICE_ROLE_KEY,
    });

    const anonClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: authHeader,
            apikey: SUPABASE_ANON_KEY,
          },
        },
      }
    );

    console.log("Checking user from JWT");

    const {
      data: { user: callerUser },
      error: authError,
    } = await anonClient.auth.getUser();

    console.log("Auth result", {
      authError: authError?.message,
      callerUserId: callerUser?.id,
    });

    if (authError || !callerUser) {
      console.log("JWT validation failed");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      SUPABASE_URL,
      SERVICE_ROLE_KEY
    );

    console.log("Checking admin status");

    const { data: callerProfile } = await adminClient
      .from("users")
      .select("is_admin")
      .eq("id", callerUser.id)
      .maybeSingle();

    console.log("Admin check result:", callerProfile);

    if (!callerProfile?.is_admin) {
      console.log("User is not admin");
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { targetUserId, password, email } = await req.json();

    console.log("Payload received", {
      targetUserId,
      hasPassword: !!password,
      hasEmail: !!email,
    });

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "Missing targetUserId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!password && !email) {
      return new Response(JSON.stringify({ error: "Missing password or email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updatePayload: { password?: string; email?: string } = {};
    if (password) updatePayload.password = password;
    if (email) updatePayload.email = email;

    console.log("Updating user in auth");

    const { error: updateError } =
      await adminClient.auth.admin.updateUserById(targetUserId, updatePayload);

    if (updateError) {
      console.log("Auth update error", updateError.message);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("User updated successfully");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.log("Unexpected error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});