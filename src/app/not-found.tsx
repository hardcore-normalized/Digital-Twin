import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-sm text-text-3">404</p>
      <h1 className="mt-2 font-serif text-3xl font-medium">Page not found</h1>
      <ButtonLink href="/" variant="secondary" className="mt-6">Go home</ButtonLink>
    </div>
  );
}
