import { Link, useNavigate } from "react-router-dom";
import { Menu, X, ShoppingBag } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { Logo } from "./Logo";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ${
        scrolled 
          ? "bg-black/70 backdrop-blur-xl border-b border-white/5 py-3" 
          : "bg-transparent py-5"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between px-6">
        <Link to="/" className="flex items-center">
          <Logo className="w-auto h-auto" variant="white" />
        </Link>

        <nav className="hidden md:flex items-center gap-10">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-white/70 hover:text-primary hover:text-neon-glow transition-all duration-300"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-6">
          <button className="text-white/70 hover:text-white transition-colors">
            <ShoppingBag className="h-5 w-5" />
          </button>
          {isAuthenticated ? (
            <Button 
              className="rounded-full px-6 font-semibold bg-[#AAFF00] text-black hover:bg-[#AAFF00]/95 hover:shadow-[0_0_20px_rgba(170,255,0,0.5)] transition-all duration-300"
              onClick={() => navigate("/dashboard")}
            >
              Dashboard
            </Button>
          ) : (
            <>
              <button 
                className="text-sm font-bold text-white/80 hover:text-[#AAFF00] transition-colors"
                onClick={() => navigate("/login")}
              >
                Login
              </button>
              <Button 
                className="rounded-full px-8 py-5 bg-[#AAFF00] text-black hover:bg-[#AAFF00]/90 font-bold shadow-[0_0_15px_rgba(170,255,0,0.3)] hover:shadow-[0_0_25px_rgba(170,255,0,0.6)] transition-all duration-300"
                onClick={() => navigate("/register")}
              >
                Sign up
              </Button>
            </>
          )}
        </div>

        <div className="flex md:hidden items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/10" 
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/5 px-6 py-5 space-y-4 animate-fade-in bg-black/95 backdrop-blur-2xl">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="block text-base font-medium text-white/70 hover:text-primary"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="flex flex-col gap-3 pt-3 border-t border-white/5">
            {isAuthenticated ? (
              <Button 
                className="w-full bg-[#AAFF00] text-black font-bold" 
                onClick={() => { setOpen(false); navigate("/dashboard"); }}
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  className="w-full border-white/20 text-white hover:bg-white/10 bg-transparent" 
                  onClick={() => { setOpen(false); navigate("/login"); }}
                >
                  Log in
                </Button>
                <Button 
                  className="w-full bg-[#AAFF00] text-black font-bold" 
                  onClick={() => { setOpen(false); navigate("/register"); }}
                >
                  Sign up
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

