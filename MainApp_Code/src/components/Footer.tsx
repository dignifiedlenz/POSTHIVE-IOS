import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t bg-black">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-muted-foreground">
          <div className="mb-2 sm:mb-0">
            © {currentYear} Lorenz Schäfer. All rights reserved.
          </div>
          <nav className="flex gap-4">
            <Link 
              href="/legal/terms" 
              className="hover:text-foreground transition-colors"
            >
              Terms
            </Link>
            <Link 
              href="/legal/privacy" 
              className="hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link 
              href="/legal/imprint" 
              className="hover:text-foreground transition-colors"
            >
              Imprint
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
} 