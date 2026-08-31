"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GraduationCap, Sparkles } from "lucide-react";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-hero-gradient lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-gradient-radial from-indigo/20 via-transparent to-transparent opacity-60" />
        <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-indigo/20 blur-3xl" />
        <div className="absolute -right-16 bottom-1/4 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />

        <Link href="/" className="relative z-10 flex items-center gap-3 text-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo/20 ring-1 ring-indigo/30">
            <GraduationCap className="h-5 w-5 text-indigo" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Zynext TalentHub</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative z-10 max-w-md space-y-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo/20 bg-indigo/10 px-3 py-1 text-xs font-medium text-indigo">
            <Sparkles className="h-3.5 w-3.5" />
            Enterprise learning platform
          </div>
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight">
            Train your teams with clarity and confidence
          </h1>
          <p className="text-muted-foreground text-balance text-lg leading-relaxed">
            Org-aware courses, certificates, and analytics — built for admins who care about
            craft.
          </p>
        </motion.div>

        <p className="relative z-10 text-muted-foreground text-sm">
          © {new Date().getFullYear()} Zynext TalentHub. All rights reserved.
        </p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="space-y-2 lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-indigo" />
              <span className="font-semibold">Zynext TalentHub</span>
            </Link>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          </div>

          {children}

          {footer && <div className="text-muted-foreground text-center text-sm">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
