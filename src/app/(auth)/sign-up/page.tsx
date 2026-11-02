import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/access";
import { enabledSocialProviders } from "@/lib/auth";

export const metadata = { title: "Create account" };

export default async function SignUp({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams;
  const next = demo ? "/app?demo=1" : "/app";
  if (await getCurrentUser()) redirect(next);
  return <AuthForm mode="sign-up" social={enabledSocialProviders} next={next} />;
}
