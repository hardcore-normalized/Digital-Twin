import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/access";
import { enabledSocialProviders } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/app");
  const { error } = await searchParams;
  return <AuthForm mode="sign-in" social={enabledSocialProviders} next="/app" initialError={error} />;
}
