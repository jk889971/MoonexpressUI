//app/not-found.tsx
'use client';

export default function NotFound() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center gap-4">
      <p className="text-3xl font-bold">404&nbsp;—&nbsp;Page not found</p>
      <a href="/" className="underline text-sky-400">Go home</a>
    </div>
  );
}