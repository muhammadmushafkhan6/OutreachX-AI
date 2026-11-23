import { Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  MapPin,
  Zap,
  Shield,
  BarChart3,
  FileSpreadsheet,
  Sparkles,
  CreditCard,
  Target,
  Layout,
  Clock,
  Loader2,
  CheckCircle2,
  Search,
  Database,
  Cpu,
  ShieldCheck,
  Mail,
  MessageSquare,
  Send,
  Instagram,
  Globe,
  Smartphone,
  Music2
} from "lucide-react";

function ProcessFlow() {
  const [step, setStep] = useState(0);
  const stages = [
    { label: "Queued", icon: Clock },
    { label: "Processing", icon: Loader2, animate: "animate-loader" },
    { label: "Scraping", icon: Globe, animate: "animate-spin-slow" },
    { label: "AI Analyzing", icon: Bot, animate: "animate-pulse" },
    { label: "Completed", icon: CheckCircle2 },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % stages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [stages.length]);

  return (
    <div className="flex flex-wrap justify-center gap-8 md:gap-16 py-12 px-6 bg-[#081208]/50 rounded-[2.5rem] border border-white/5 backdrop-blur-sm">
      {stages.map((s, i) => {
        const isActive = i === step;
        const isDone = i < step;
        return (
          <div key={i} className={`flex flex-col items-center gap-4 transition-all duration-500 ${isActive ? 'scale-110' : 'opacity-40'}`}>
            <div className={`h-16 w-16 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
              isActive ? 'border-primary bg-primary/20 text-primary shadow-[0_0_20px_rgba(192,255,0,0.3)]' : 
              isDone ? 'border-primary text-primary bg-primary/5' : 'border-white/10 text-white'
            }`}>
              <s.icon className={`h-8 w-8 ${isActive && s.animate ? s.animate : ''}`} />
            </div>
            <span className={`text-xs font-black uppercase tracking-wider transition-colors duration-500 ${isActive ? 'text-primary' : 'text-white/40'}`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Counter({ end, duration = 2000, decimals = 0, suffix = "" }: { end: number, duration?: number, decimals?: number, suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(progress * end);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return <span>{count.toFixed(decimals)}{suffix}</span>;
}
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/layout/Logo";

const features = [
  {
    icon: MapPin,
    title: "Google Maps Leads",
    description: "Extract high-quality business leads from Google Maps with contact info, ratings, and location data automatically.",
  },
  {
    icon: Instagram,
    title: "Instagram Leads",
    description: "Scrape and collect Instagram profiles, followers, and engagement data to build targeted lead lists.",
  },
  {
    icon: Music2,
    title: "TikTok Leads",
    description: "Scrape TikTok profiles, followers, video engagement, and bio data to build hyper-targeted lead lists for your business.",
  },
  {
    icon: MessageSquare,
    title: "Automated WhatsApp Messages",
    description: "Send personalized, automated WhatsApp messages to your leads for effective outreach at scale.",
  },
  {
    icon: Send,
    title: "Instagram DMs",
    description: "Automate Instagram direct messages to connect with potential customers and grow your business.",
  },
  {
    icon: FileSpreadsheet,
    title: "Bulk Data Flow",
    description: "Process massive lead lists instantly with our high-performance background scraping and AI pipeline.",
  },
  {
    icon: Bot,
    title: "AI Business Analysis",
    description: "Deep learning models classify industries, analyze services, and score leads based on their online presence.",
  },
];

const steps = [
  { n: "01", title: "Google Maps Leads", desc: "Search and extract business leads from Google Maps with contact details and location info." },
  { n: "02", title: "Instagram Leads", desc: "Collect Instagram profiles, followers, and engagement data for targeted outreach." },
  { n: "03", title: "TikTok Leads", desc: "Scrape TikTok profiles, followers, and video engagement data to build hyper-targeted lead lists." },
  { n: "04", title: "Website Data Scraping", desc: "Scrape websites to extract contact info, product data, and business details automatically." },
  { n: "05", title: "AI Lead Analysis", desc: "AI analyzes and scores leads to prioritize high-potential prospects for your business." },
  { n: "06", title: "WhatsApp & Instagram DMs", desc: "Automate personalized WhatsApp messages and Instagram DMs to connect with leads at scale." },
  { n: "07", title: "Data Export", desc: "Get structured JSON, CSV, or Excel files ready for your sales CRM." },
];

export function Landing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", handleResize);

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.tx = e.clientX - rect.left - width / 2;
      mouse.ty = e.clientY - rect.top - height / 2;
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
    }

    interface Point3D {
      x: number; y: number; z: number;
      ox: number; oy: number; oz: number;
    }

    const points: Point3D[] = [];
    const sphereRadius = Math.min(width, height) * 0.22 || 170;
    const rings = 8;
    const segments = 14;

    for (let i = 1; i < rings; i++) {
      const theta = (i * Math.PI) / rings;
      for (let j = 0; j < segments; j++) {
        const phi = (j * 2 * Math.PI) / segments;
        const x = sphereRadius * Math.sin(theta) * Math.cos(phi);
        const y = sphereRadius * Math.sin(theta) * Math.sin(phi);
        const z = sphereRadius * Math.cos(theta);
        points.push({ x, y, z, ox: x, oy: y, oz: z });
      }
    }

    const brainPoints: Point3D[] = [];
    const brainPointsCount = 20;
    for (let i = 0; i < brainPointsCount; i++) {
      const r = sphereRadius * (0.25 + Math.random() * 0.45);
      const theta = Math.random() * Math.PI;
      const phi = Math.random() * 2 * Math.PI;
      const x = r * Math.sin(theta) * Math.cos(phi);
      const y = r * Math.sin(theta) * Math.sin(phi);
      const z = r * Math.cos(theta);
      brainPoints.push({ x, y, z, ox: x, oy: y, oz: z });
    }

    interface SpaceParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      life: number;
      maxLife: number;
    }

    const spaceParticles: SpaceParticle[] = [];
    const maxParticles = 60;

    for (let i = 0; i < maxParticles; i++) {
      spaceParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -0.2 - Math.random() * 0.4,
        size: 1 + Math.random() * 3,
        alpha: 0.15 + Math.random() * 0.45,
        life: Math.random() * 100,
        maxLife: 150 + Math.random() * 200,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Space Particles
      spaceParticles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        if (p.life >= p.maxLife || p.y < -10 || p.x < -10 || p.x > width + 10) {
          p.x = Math.random() * width;
          p.y = height + 10;
          p.vx = (Math.random() - 0.5) * 0.2;
          p.vy = -0.2 - Math.random() * 0.4;
          p.life = 0;
          p.alpha = 0.15 + Math.random() * 0.4;
          p.size = 1 + Math.random() * 3;
        }

        const currentAlpha = p.alpha * (1 - p.life / p.maxLife);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(170, 255, 0, ${currentAlpha * 0.35})`;
        ctx.fill();
      });

      // 2. Rotate & Project 3D Sphere & Brain Core
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      const baseRotX = Date.now() * 0.00012;
      const baseRotY = Date.now() * 0.0002;
      const radX = (mouse.y / height) * 0.5 + baseRotX;
      const radY = (mouse.x / width) * 0.5 + baseRotY;

      const cosX = Math.cos(radX);
      const sinX = Math.sin(radX);
      const cosY = Math.cos(radY);
      const sinY = Math.sin(radY);

      const project = (p: Point3D) => {
        const x1 = p.ox * cosY - p.oz * sinY;
        const z1 = p.ox * sinY + p.oz * cosY;
        const y2 = p.oy * cosX - z1 * sinX;
        const z2 = p.oy * sinX + z1 * cosX;

        const depth = 450;
        const scale = depth / (depth + z2);
        const sx = width / 2 + x1 * scale;
        const sy = height / 2 + y2 * scale;
        return { x: sx, y: sy, z: z2 };
      };

      const projSphere = points.map(project);
      const projBrain = brainPoints.map(project);

      // Draw Connections (Sphere Wireframe)
      ctx.lineWidth = 0.8;
      for (let r = 0; r < rings - 1; r++) {
        for (let s = 0; s < segments; s++) {
          const idx = r * segments + s;
          const nextS = r * segments + ((s + 1) % segments);
          const nextR = (r + 1) * segments + s;

          const depthAlpha = Math.max(0.01, 0.12 * (1 - (projSphere[idx].z / sphereRadius)));

          ctx.beginPath();
          ctx.moveTo(projSphere[idx].x, projSphere[idx].y);
          ctx.lineTo(projSphere[nextS].x, projSphere[nextS].y);
          ctx.strokeStyle = `rgba(170, 255, 0, ${depthAlpha})`;
          ctx.stroke();

          if (r < rings - 2) {
            ctx.beginPath();
            ctx.moveTo(projSphere[idx].x, projSphere[idx].y);
            ctx.lineTo(projSphere[nextR].x, projSphere[nextR].y);
            ctx.strokeStyle = `rgba(170, 255, 0, ${depthAlpha * 0.7})`;
            ctx.stroke();
          }
        }
      }

      // Draw Inner Brain Connections
      projBrain.forEach((bp, i) => {
        projBrain.forEach((bp2, j) => {
          if (i === j) return;
          const dx = bp.x - bp2.x;
          const dy = bp.y - bp2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 85) {
            const alpha = 0.15 * (1 - dist / 85) * (1 - bp.z / sphereRadius);
            ctx.beginPath();
            ctx.moveTo(bp.x, bp.y);
            ctx.lineTo(bp2.x, bp2.y);
            ctx.strokeStyle = `rgba(170, 255, 0, ${Math.max(0.01, alpha)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        });

        projSphere.forEach((sp) => {
          const dx = bp.x - sp.x;
          const dy = bp.y - sp.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 65) {
            const alpha = 0.1 * (1 - dist / 65) * (1 - bp.z / sphereRadius);
            ctx.beginPath();
            ctx.moveTo(bp.x, bp.y);
            ctx.lineTo(sp.x, sp.y);
            ctx.strokeStyle = `rgba(170, 255, 0, ${Math.max(0.01, alpha)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      // Draw Outer Points
      projSphere.forEach((p) => {
        const size = Math.max(0.8, 2.2 * (1 - p.z / sphereRadius));
        const alpha = Math.max(0.1, 0.65 * (1 - p.z / sphereRadius));
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(170, 255, 0, ${alpha})`;
        ctx.fill();
      });

      // Draw Brain core nodes
      projBrain.forEach((p) => {
        const size = Math.max(1.2, 3.2 * (1 - p.z / sphereRadius));
        const alpha = Math.max(0.15, 0.8 * (1 - p.z / sphereRadius));
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(170, 255, 0, ${alpha})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (container) {
        container.removeEventListener("mousemove", handleMouseMove);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="dark min-h-screen bg-[#020502] text-white selection:bg-[#AAFF00]/30 selection:text-[#AAFF00] overflow-x-hidden relative">
      <Navbar />

      {/* Hero */}
      <section ref={containerRef} className="relative min-h-screen flex flex-col justify-center items-center pt-32 pb-24 overflow-hidden bg-[#020502]">
        {/* Dynamic Canvas Backing */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-80" style={{ mixBlendMode: "screen" }} />

        {/* Cinematic Backdrop Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#AAFF00]/8 blur-[160px] rounded-full pointer-events-none z-0" />
        <div className="absolute top-[20%] left-[15%] w-[300px] h-[300px] bg-[#AAFF00]/4 blur-[120px] rounded-full pointer-events-none z-0" />

        <div className="container relative z-10 mx-auto px-6 text-center flex flex-col items-center justify-center min-h-[70vh] w-full">
          
          <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[7vw] font-black tracking-tighter leading-[0.85] max-w-6xl mx-auto uppercase relative select-none pointer-events-none font-display">
            SCALABLE WEB <br />
            SCRAPING & <span className="text-[#AAFF00] text-neon-glow-strong">AI ANALYSIS</span>
          </h1>
          
          <p className="mt-10 text-lg sm:text-xl text-white/60 max-w-2xl mx-auto font-medium leading-relaxed">
            Transform raw websites into actionable business intelligence. Our intelligent automation 
            scans, analyzes, and delivers high-quality leads directly to your dashboard in minutes.
          </p>
          
          <div className="mt-12 flex flex-col sm:flex-row gap-6 justify-center items-center w-full">
            <Link to="/register">
              <Button className="rounded-full px-12 py-7 bg-[#AAFF00] text-black hover:bg-[#AAFF00]/95 hover:shadow-[0_0_30px_rgba(170,255,0,0.6)] font-black text-lg transition-all duration-300">
                Start Scraping
              </Button>
            </Link>
            <Link to="/register">
              <Button variant="ghost" className="rounded-full px-12 py-7 font-black text-lg text-white/80 hover:text-white border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 transition-all duration-300">
                How it works
              </Button>
            </Link>
          </div>

          {/* Floating Glassmorphic Status Cards */}
          <motion.div
            initial={{ opacity: 0, x: -40, y: 10 }}
            animate={{ opacity: 1, x: 0, y: [-5, 5, -5] }}
            transition={{ 
              opacity: { delay: 0.4, duration: 0.8 },
              x: { delay: 0.4, duration: 0.8 },
              y: { duration: 5, repeat: Infinity, ease: "easeInOut" }
            }}
            className="absolute left-[5%] top-[25%] hidden xl:flex flex-col gap-2 rounded-[1.8rem] border border-white/15 bg-black/50 backdrop-blur-xl p-6 shadow-2xl max-w-[240px] text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-full bg-[#AAFF00]/20 flex items-center justify-center">
                <Search className="h-4 w-4 text-[#AAFF00]" />
              </div>
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Scraper Engine</span>
            </div>
            <p className="text-sm font-bold text-white flex items-center gap-2 mt-1">
              Scraping... <span className="h-2 w-2 rounded-full bg-[#AAFF00] animate-ping" />
            </p>
            <div className="h-1.5 w-full bg-white/10 rounded-full mt-3 overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="h-full bg-[#AAFF00] shadow-[0_0_10px_#AAFF00]"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40, y: -20 }}
            animate={{ opacity: 1, x: 0, y: [5, -5, 5] }}
            transition={{ 
              opacity: { delay: 0.6, duration: 0.8 },
              x: { delay: 0.6, duration: 0.8 },
              y: { duration: 6, repeat: Infinity, ease: "easeInOut" }
            }}
            className="absolute right-[5%] top-[22%] hidden xl:flex flex-col gap-2 rounded-[1.8rem] border border-white/15 bg-black/50 backdrop-blur-xl p-6 shadow-2xl max-w-[260px] text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-full bg-[#AAFF00]/20 flex items-center justify-center">
                <Bot className="h-4 w-4 text-[#AAFF00]" />
              </div>
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">AI Insights</span>
            </div>
            <p className="text-xs font-black text-[#AAFF00] uppercase mt-1">Lead Detected</p>
            <p className="text-[12px] font-medium text-white/80 leading-relaxed mt-0.5">
              "High quality lead detected. Industry: SaaS, Location: USA."
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: [0, -10, 0] }}
            transition={{ 
              opacity: { delay: 0.8, duration: 0.8 },
              y: { duration: 7, repeat: Infinity, ease: "easeInOut" }
            }}
            className="absolute left-[12%] bottom-[12%] hidden xl:flex flex-col gap-2 rounded-[1.8rem] border border-white/15 bg-black/50 backdrop-blur-xl p-6 shadow-2xl max-w-[220px] text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-full bg-[#AAFF00]/20 flex items-center justify-center">
                <Globe className="h-4 w-4 text-[#AAFF00]" />
              </div>
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Data Streams</span>
            </div>
            <p className="text-sm font-bold text-white flex items-center gap-2 mt-1">
              <Counter end={42892} duration={2000} /> Contacts
            </p>
            <div className="flex gap-1.5 mt-2.5">
              <span className="h-1.5 w-8 bg-[#AAFF00]/40 rounded-full animate-pulse" />
              <span className="h-1.5 w-12 bg-[#AAFF00] rounded-full animate-pulse delay-300" />
              <span className="h-1.5 w-6 bg-[#AAFF00]/20 rounded-full animate-pulse delay-700" />
            </div>
          </motion.div>

        </div>
      </section>

      {/* Dark Section - Features */}
      <section id="features" className="py-32 bg-[#081208] text-white relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(192,255,0,0.05),transparent_70%)]" />
        <div className="container relative mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-5xl font-black tracking-tighter uppercase mb-6">
              ADVANCED AI LEAD <br />
              <span className="text-primary">INTELLIGENCE</span> AT SCALE
            </h2>
            <div className="max-w-4xl mx-auto mt-16 mb-24">
               <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary/60 mb-8">Real-time Data Pipeline</p>
               <ProcessFlow />
            </div>
            <Button className="rounded-full bg-white text-black hover:bg-white/90 font-bold px-8">
              Explore Features
            </Button>
          </div>
          
          <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: i * 0.12, duration: 0.6 }}
                whileHover={{ y: -12, transition: { duration: 0.25 } }}
                className="rounded-3xl p-8 group bg-gradient-to-br from-[#0c1a0c] to-[#081208] border border-white/10 hover:border-primary/40 transition-all duration-500 shadow-lg hover:shadow-[0_0_30px_rgba(170,255,0,0.15)]"
              >
                <motion.div
                  whileHover={{ rotate: 8, scale: 1.15 }}
                  className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 group-hover:shadow-[0_0_20px_rgba(170,255,0,0.3)] transition-all duration-300"
                >
                  <f.icon className="h-8 w-8 text-primary" />
                </motion.div>
                <h3 className="text-xl font-bold mb-3 text-white">{f.title}</h3>
                <p className="text-white/70 leading-relaxed text-sm mb-6">{f.description}</p>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 bg-primary rounded-full" />
                  <div className="h-1.5 flex-1 bg-white/10 rounded-full" />
                  <ArrowRight className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* White Section - How it works */}
      <section id="how-it-works" className="py-32 bg-background">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between mb-24 gap-12">
            <div className="max-w-xl">
              <h2 className="text-5xl font-black tracking-tighter uppercase mb-8 leading-[1] text-foreground">
                SMART RESEARCH TOOLS <br />
                FOR DATA <span className="text-primary bg-primary/10 px-3 rounded-xl">CONFIDENCE</span>
              </h2>
              <div className="flex flex-wrap md:flex-nowrap gap-3 items-center">
                {['Google Maps', 'Instagram Leads', 'TikTok Leads', 'Website Scraping', 'AI Analysis', 'WhatsApp', 'Instagram DMs', 'Export'].map((tag, idx) => (
                  <span key={tag} className="px-5 py-2 rounded-full border border-border text-sm font-bold hover:bg-foreground hover:text-background transition-all cursor-pointer text-foreground whitespace-nowrap">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Column - Steps Style */}
            <div className="space-y-12">
               <div className="max-w-md">
                 <h3 className="text-3xl font-black uppercase tracking-tight mb-4 text-foreground">HOW OUTREACH X AUTOMATES YOUR RESEARCH</h3>
                 <div className="mt-10 space-y-8">
                    {steps.map((s, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ delay: i * 0.1, duration: 0.5 }}
                        className="flex gap-6 items-start group"
                      >
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          className="flex-shrink-0 w-12 h-12 rounded-2xl bg-muted text-foreground group-hover:bg-primary group-hover:text-black transition-colors flex items-center justify-center font-black text-lg"
                        >
                          {s.n}
                        </motion.div>
                        <div>
                          <h4 className="font-bold uppercase tracking-tight mb-1 text-foreground">{s.title}</h4>
                          <p className="text-sm text-muted-foreground font-medium">{s.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                 </div>
               </div>
               <div className="flex gap-4 pt-4">
                 <Button className="rounded-full bg-foreground text-background font-bold px-8 py-6 hover:bg-foreground/90">Start Your Flow</Button>
                 <Button variant="ghost" className="font-bold text-foreground">See Documentation</Button>
               </div>
            </div>
            
            {/* Right Column - Mockups */}
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 -ml-8 -mt-8">
              {[
                { icon: MapPin, label: "Google Maps", metric: "Businesses Found", end: 8542, width: "4/5" },
                { icon: Instagram, label: "Instagram", metric: "Profiles Collected", end: 12456, width: "3/4" },
                { icon: Globe, label: "Websites", metric: "Sites Scraped", end: 42892, width: "5/6" },
              ].map((mock, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i === 0 ? -30 : i === 1 ? 0 : 30, y: 30 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: i * 0.15, duration: 0.5 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="rounded-[2rem] bg-muted/50 overflow-hidden flex items-center justify-center p-6"
                >
                  <div className="w-full rounded-2xl p-5 bg-[#081208] text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 relative">
                    <div className="flex justify-between items-start mb-6">
                       <motion.div
                         animate={{
                           rotate: [0, -5, 5, -5, 0],
                         }}
                         transition={{
                           duration: 2,
                           repeat: Infinity,
                           repeatDelay: 3,
                         }}
                         className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center"
                       >
                          <mock.icon className="h-4 w-4 text-primary" />
                        </motion.div>
                       <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{mock.label}</span>
                    </div>
                    <div className="mb-5">
                      <p className="text-white/40 text-[11px] font-medium mb-1">{mock.metric}</p>
                      <h4 className="text-2xl font-black text-white">
                        <Counter end={mock.end} duration={3000} />
                      </h4>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                        <span className="text-[8px] font-bold text-primary uppercase tracking-tighter">Live Scraping</span>
                      </div>
                    </div>
                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: mock.width }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.5, ease: "easeOut", delay: i * 0.2 }}
                        className="h-full bg-primary shadow-[0_0_15px_rgba(192,255,0,0.5)]"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 bg-[#081208] text-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="text-5xl font-black tracking-tighter uppercase mb-6">SIMPLE TRANSPARENT <span className="text-primary">PRICING</span></h2>
            <p className="text-white/60 font-medium text-lg">Scale your research operations with plans that grow with your business.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "Starter", price: "49", features: ["1,000 Websites / mo", "Basic AI Analysis", "CSV Export", "Email Support"] },
              { name: "Professional", price: "149", features: ["10,000 Websites / mo", "Advanced AI Insights", "Bulk Lead Enrichment", "Priority API Access"], popular: true },
              { name: "Enterprise", price: "Custom", features: ["Unlimited Operations", "Custom AI Training", "Dedicated Infrastructure", "24/7 Priority Support"] }
            ].map((plan, i) => (
              <div key={i} className={`rounded-[2.5rem] p-10 border ${plan.popular ? 'border-primary bg-[#122412]' : 'border-white/5 bg-[#0c1a0c]'} relative`}>
                {plan.popular && <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-black px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Most Popular</span>}
                <h3 className="text-2xl font-bold mb-2 uppercase">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-5xl font-black">{plan.price === "Custom" ? "" : "$"}{plan.price}</span>
                  {plan.price !== "Custom" && <span className="text-white/40 font-bold uppercase tracking-widest text-xs">/ month</span>}
                </div>
                <ul className="space-y-4 mb-10">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm font-medium text-white/80">
                      <Zap className="h-4 w-4 text-primary fill-primary" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Button className={`w-full rounded-full py-6 font-bold ${plan.popular ? 'bg-primary text-black' : 'bg-white text-black'} hover:opacity-90`}>
                  {plan.price === "Custom" ? "Contact Sales" : "Get Started"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Global Reach Section */}
      <section className="py-32 bg-muted/30 overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
               <h2 className="text-5xl md:text-6xl font-black tracking-tighter uppercase leading-[0.9] mb-8">
                 OUTREACH X IS AVAILABLE <br />
                 <span className="text-primary">ALMOST GLOBALLY</span>
               </h2>
               <p className="text-lg text-muted-foreground font-medium mb-10 max-w-lg">
                 Our infrastructure is distributed across continents, allowing you to bypass geo-restrictions
                 and extract data from any localized business market with high reliability.
               </p>
               <div className="grid grid-cols-2 gap-8">
                  <div className="p-6 bg-card rounded-3xl border border-border shadow-sm">
                    <h4 className="text-3xl font-black mb-1 text-foreground">
                      <Counter end={99.9} decimals={1} suffix="%" />
                    </h4>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Uptime Rate</p>
                  </div>
                  <div className="p-6 bg-card rounded-3xl border border-border shadow-sm">
                    <h4 className="text-3xl font-black mb-1 text-foreground">
                      <Counter end={50} suffix="+" />
                    </h4>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Proxy Regions</p>
                  </div>
               </div>
            </div>
            <div className="relative">
              <div className="aspect-video bg-[#081208] rounded-[2.5rem] shadow-2xl overflow-hidden group relative">
                 <video
                    src="/Demo.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                 />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 bg-primary text-black">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-6xl font-black tracking-tighter uppercase mb-12 leading-[0.9]">
            READY TO SUPERCHARGE <br />YOUR LEAD GENERATION?
          </h2>
          <Link to="/register">
            <Button className="rounded-full bg-black text-white hover:bg-black/90 font-black px-12 py-8 text-xl uppercase tracking-tighter">
              Start Free Scraping <ArrowRight className="h-6 w-6 ml-2" />
            </Button>
          </Link>
          <p className="mt-8 font-bold uppercase tracking-widest text-sm opacity-60">
            No credit card required • Instant AI Analysis • Export Ready
          </p>
        </div>
      </section>

      <footer className="bg-black text-white py-20 border-t border-white/5">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-10">
            <nav className="flex gap-10 text-sm font-bold uppercase tracking-widest text-white/40">
              <a href="#" className="hover:text-primary transition-colors">Twitter</a>
              <a href="#" className="hover:text-primary transition-colors">LinkedIn</a>
              <a href="#" className="hover:text-primary transition-colors">Documentation</a>
            </nav>
            <div className="text-white/40 font-bold text-sm uppercase tracking-widest">
              © {new Date().getFullYear()} Outreach X AI • Automated Web Research
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
