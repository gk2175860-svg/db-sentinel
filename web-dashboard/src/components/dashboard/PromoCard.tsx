import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';

export function PromoCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-db-primary/20 via-db-purple/10 to-db-card border border-db-primary/30"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-db-primary/10 via-transparent to-transparent" />
      <div className="absolute top-4 right-4 w-32 h-32 bg-db-primary/10 rounded-full blur-2xl" />
      <div className="absolute bottom-4 left-4 w-24 h-24 bg-db-purple/10 rounded-full blur-2xl" />
      
      <div className="relative flex items-center justify-between">
        <div className="max-w-md">
          <div className="flex items-center gap-2 mb-3">
            <Icons.Sparkles className="w-5 h-5 text-db-primary" />
            <span className="text-sm font-medium text-db-primary">AI Powered</span>
          </div>
          <h3 className="text-2xl font-bold text-db-text mb-2">
            Your Database, Our Intelligence.
          </h3>
          <p className="text-db-text-secondary mb-4">
            Smarter Database Management with AI. Automate investigations, optimize queries, and prevent incidents before they happen.
          </p>
          <button className="px-4 py-2 bg-db-primary text-db-text rounded-lg font-medium hover:bg-db-primary/90 transition-colors flex items-center gap-2">
            Explore Features
            <Icons.ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="hidden lg:block relative">
          <div className="w-48 h-48 rounded-2xl bg-db-card border border-db-secondary flex items-center justify-center p-4">
            <div className="text-center">
              <Icons.Bot className="w-16 h-16 text-db-primary/50 mx-auto mb-3" />
              <p className="text-sm text-db-text-secondary">AI Agent</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}