import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <p className="text-5xl font-bold text-gray-200">404</p>
        <h1 className="text-xl font-semibold text-gray-900">Page not found</h1>
        <p className="text-sm text-gray-500">This page doesn&apos;t exist or was moved.</p>
        <Link href="/pipeline" className="inline-block mt-2 text-sm text-blue-600 hover:underline">
          Back to Pipeline
        </Link>
      </div>
    </main>
  );
}
