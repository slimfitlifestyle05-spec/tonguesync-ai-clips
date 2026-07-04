import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Home,
  Scissors,
  Languages,
  BookOpen,
  LogIn,
  LayoutDashboard,
  Mail,
  Info,
  Sparkles,
  Users,
} from "lucide-react";

type Cmd = {
  label: string;
  to: string;
  icon: React.ReactNode;
  keywords?: string;
};

const items: Cmd[] = [
  { label: "Home", to: "/", icon: <Home className="h-4 w-4" /> },
  { label: "AI Clipper", to: "/clipper", icon: <Scissors className="h-4 w-4" />, keywords: "shorts clip video" },
  { label: "AI Dubbing", to: "/dubbing", icon: <Languages className="h-4 w-4" />, keywords: "translate voice" },
  { label: "Dashboard", to: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Showcase", to: "/showcase", icon: <Sparkles className="h-4 w-4" /> },
  { label: "Viral Ideas", to: "/community", icon: <Users className="h-4 w-4" />, keywords: "viral ideas trending shorts pdf playbook community" },
  { label: "Blog", to: "/blog", icon: <BookOpen className="h-4 w-4" /> },
  { label: "About", to: "/about", icon: <Info className="h-4 w-4" /> },
  { label: "Contact", to: "/contact", icon: <Mail className="h-4 w-4" /> },
  { label: "Sign in", to: "/auth", icon: <LogIn className="h-4 w-4" /> },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, features, docs…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {items.map((it) => (
            <CommandItem
              key={it.to}
              value={`${it.label} ${it.keywords ?? ""}`}
              onSelect={() => {
                setOpen(false);
                navigate({ to: it.to });
              }}
            >
              {it.icon}
              <span className="ml-2">{it.label}</span>
              <CommandShortcut>{it.to}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}