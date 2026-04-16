"use client";

import { motion } from "framer-motion";
import { WifiOff, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { routes } from "@/lib/routes";
import { useTranslation } from "react-i18next";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

interface ServiceErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ServiceError({
  title = "Connection issue",
  message = "Service is temporarily unavailable. Please try again in a moment.",
  onRetry,
  retrying,
}: ServiceErrorProps) {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <motion.div
        className="flex flex-col items-center gap-5 text-center max-w-sm"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Icon */}
        <motion.div variants={itemVariants}>
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-20"
              style={{ background: "var(--primary)" }}
            />
            <div className="relative h-16 w-16 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center">
              <WifiOff className="h-7 w-7 text-muted-foreground" />
            </div>
          </div>
        </motion.div>

        {/* Text */}
        <motion.div variants={itemVariants} className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {message}
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div variants={itemVariants} className="flex items-center gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={retrying}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
              {t("retry")}
            </button>
          )}
          <Link
            href={routes.home}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("back")}
          </Link>
        </motion.div>

        {/* Status dots */}
        <motion.div variants={itemVariants} className="flex items-center gap-3 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Your browser
          </div>
          <div className="w-8 border-t border-dashed border-muted-foreground/30" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            1tt.dev
          </div>
          <div className="w-8 border-t border-dashed border-destructive/50" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            API
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
