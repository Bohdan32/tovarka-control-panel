"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

function readCredentials(fd: FormData) {
  return {
    email: String(fd.get("email") ?? "").trim().toLowerCase(),
    password: String(fd.get("password") ?? ""),
    mode: String(fd.get("mode") ?? "signin"),
  };
}

export async function login(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const { email, password, mode } = readCredentials(fd);
  if (!email || password.length < 8) {
    return { error: "Вкажи email і пароль від 8 символів" };
  }

  const supabase = await createClient();

  if (mode === "signup") {
    // Account creation is limited to emails in public.members by a database trigger.
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return {
        error: error.message.includes("Database error")
          ? "Цей email не має доступу до Товарки"
          : `Не вдалося створити пароль: ${error.message}`,
      };
    }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Невірний email або пароль" };
  }
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
