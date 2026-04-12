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
          {/* No outer padding — pages control their own layout */}
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
