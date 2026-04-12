import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-5">
      <p className="text-8xl font-black text-gray-800">404</p>
      <h1 className="text-2xl font-bold text-white">Page not found</h1>
      <p className="text-gray-400 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" className="btn-primary">Back to Store</Link>
    </div>
  );
}
