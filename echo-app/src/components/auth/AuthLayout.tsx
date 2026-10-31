import { ReactNode } from "react";
import { motion } from "framer-motion";
import { MessageSquare, ShieldCheck, Zap, Users, Sparkles } from "lucide-react";

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export const AuthLayout = ({
  children,
  title = "Welcome to Echo Chat",
  subtitle = "Connect with your team in real-time",
}: AuthLayoutProps) => {
  return (
    <div className="relative h-screen w-full flex items-center justify-center bg-[#0d0e15] overflow-hidden p-6 lg:p-12 selection:bg-[#0066ff] selection:text-white">
      {/* 1. Dynamic Moving Ambient Glowing Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.25, 0.95, 1],
          x: [0, 50, -30, 0],
          y: [0, -40, 30, 0],
          opacity: [0.35, 0.55, 0.4, 0.35],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-[-10%] left-[-8%] w-[550px] h-[550px] bg-gradient-to-br from-[#0066ff] to-[#00b4d8] rounded-full blur-[130px] pointer-events-none"
      />

      <motion.div
        animate={{
          scale: [1, 1.3, 1, 1],
          x: [0, -40, 50, 0],
          y: [0, 50, -20, 0],
          opacity: [0.3, 0.5, 0.35, 0.3],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
        className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-tr from-[#7928ca] to-[#ff0080] rounded-full blur-[150px] pointer-events-none"
      />

      <motion.div
        animate={{
          scale: [0.8, 1.15, 0.9, 0.8],
          opacity: [0.15, 0.3, 0.2, 0.15],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3,
        }}
        className="absolute top-[35%] left-[45%] w-[400px] h-[400px] bg-[#0066ff]/25 rounded-full blur-[120px] pointer-events-none"
      />

      {/* 2. Wallpaper & Dot Grid Ambient Overlay */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none bg-repeat mix-blend-overlay"
        style={{ backgroundImage: "url(/chat-bg.jpg)" }}
      />
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" 
      />

      {/* 3. Main Split Container */}
      <div className="relative z-10 w-full max-w-5xl h-full max-h-[820px] flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-14 my-auto">
        
        {/* Left Side: Branding, Header & Animated Highlights */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 flex flex-col justify-center text-left max-w-lg"
        >
          {/* Logo Badge with Glowing Aura */}
          <div className="flex items-center gap-3.5 mb-6">
            <motion.div
              whileHover={{ scale: 1.06, rotate: 3 }}
              whileTap={{ scale: 0.96 }}
              className="relative group cursor-pointer"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-[#0066ff] to-[#a855f7] rounded-2xl blur-md opacity-75 group-hover:opacity-100 transition duration-300" />
              <div className="relative w-13 h-13 bg-gradient-to-tr from-[#0052cc] via-[#0066ff] to-[#38bdf8] rounded-2xl flex items-center justify-center shadow-xl shadow-[#0066ff]/40 text-white">
                <MessageSquare className="w-6 h-6 text-white drop-shadow" />
              </div>
            </motion.div>
            
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-white">Echo</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#0066ff]/20 text-[#38bdf8] border border-[#0066ff]/30">
                <Sparkles className="w-2.5 h-2.5 text-[#38bdf8]" /> Live Chat
              </span>
            </div>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 tracking-tight leading-tight"
          >
            {title}
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-base text-slate-300 mt-3.5 leading-relaxed font-normal"
          >
            {subtitle}
          </motion.p>

          {/* Staggered Animated Feature Highlights */}
          <div className="mt-8 space-y-3.5 pt-6 border-t border-white/10">
            {[
              {
                icon: Zap,
                color: "text-[#38bdf8]",
                bg: "bg-[#0066ff]/20 border border-[#0066ff]/30",
                text: "Ultra-fast real-time messaging with instant updates",
                delay: 0.3,
              },
              {
                icon: Users,
                color: "text-[#c084fc]",
                bg: "bg-[#8b5cf6]/20 border border-[#8b5cf6]/30",
                text: "Collaborative group rooms & interactive typing states",
                delay: 0.4,
              },
              {
                icon: ShieldCheck,
                color: "text-emerald-400",
                bg: "bg-emerald-500/20 border border-emerald-500/30",
                text: "Secure end-to-end sessions & trusted authentication",
                delay: 0.5,
              },
            ].map((feat, index) => {
              const IconComponent = feat.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: feat.delay, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ x: 6, transition: { duration: 0.2 } }}
                  className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-white/[0.03] transition-colors cursor-default"
                >
                  <div className={`w-9 h-9 rounded-xl ${feat.bg} flex items-center justify-center ${feat.color} shadow-sm shrink-0`}>
                    <IconComponent className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-sm font-medium text-slate-200">{feat.text}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Right Side: Animated Card with Glassmorphic Border Glow */}
        <motion.div
          initial={{ opacity: 0, x: 40, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 w-full max-w-md flex items-center justify-center relative"
        >
          {/* Subtle Outer Card Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-[#0066ff]/30 to-[#8b5cf6]/30 rounded-3xl blur-xl opacity-60 pointer-events-none" />

          <div className="relative w-full flex justify-center">
            {children}
          </div>
        </motion.div>

      </div>
    </div>
  );
};
