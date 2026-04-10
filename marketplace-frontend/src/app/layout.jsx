import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';

export const metadata = {
  title: 'DocForge Marketplace — Digital Books & Music',
  description: 'Buy digital books and music albums from creators.fintigen.com',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          <main className="mx-auto max-w-6xl px-4 py-10">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
