import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HOTEL_BRAND } from "@/config/hotel";
import {
  ArrowRight,
  CheckCircle2,
  Star,
  Shield,
  Zap,
  BarChart3,
  Globe,
  Users,
  MessageSquare
} from "lucide-react";

interface LandingProps {
  onGetStarted: () => void;
}

const Landing = ({ onGetStarted }: LandingProps) => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-amber-100 selection:text-amber-900">
      {/* Navigation */}
      <nav className="fixed w-full bg-white/90 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-sm flex items-center justify-center">
              <span className="text-amber-400 font-serif font-bold text-xl">M</span>
            </div>
            <span className="font-serif text-xl font-bold tracking-tight text-slate-900">
              {HOTEL_BRAND}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Features</a>
            <a href="#solutions" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Solutions</a>
            <a href="#testimonials" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Testimonials</a>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="hidden sm:flex text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              onClick={onGetStarted}
            >
              Sign In
            </Button>
            <Button
              className="bg-slate-900 text-white hover:bg-slate-800 rounded-sm px-6 font-medium shadow-lg shadow-slate-900/10 transition-all hover:shadow-xl hover:shadow-slate-900/20"
              onClick={onGetStarted}
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-xs font-semibold tracking-wide uppercase mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Star className="w-3 h-3 fill-amber-700" />
              <span>The Gold Standard in Hospitality CRM</span>
            </div>
            <h1 className="font-serif text-5xl md:text-7xl font-medium tracking-tight leading-[1.1] text-slate-900 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
              Elevate Every <span className="italic text-slate-600">Guest Interaction</span> to an Art Form.
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              A sophisticated CRM specifically engineered for luxury hotels. Orchestrate seamless guest experiences, optimize operations, and drive loyalty with precision.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
              <Button
                className="h-12 px-8 bg-amber-500 hover:bg-amber-600 text-white rounded-sm text-base font-medium shadow-lg shadow-amber-500/25 transition-all w-full sm:w-auto"
                onClick={onGetStarted}
              >
                Request Access
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-12 px-8 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-sm text-base font-medium w-full sm:w-auto"
              >
                View Documentation
              </Button>
            </div>
          </div>
        </div>

        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-amber-50/50 to-transparent rounded-full blur-3xl opacity-60"></div>
          <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-gradient-to-t from-slate-50 to-transparent rounded-full blur-3xl opacity-40"></div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-12 border-y border-slate-100 bg-slate-50/50">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: "Partner Hotels", value: "500+" },
              { label: "Guests Managed", value: "2M+" },
              { label: "Revenue Influence", value: "$450M" },
              { label: "Uptime Guarantee", value: "99.99%" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="font-serif text-3xl md:text-4xl font-medium text-slate-900 mb-1">{stat.value}</div>
                <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="font-serif text-3xl md:text-4xl font-medium text-slate-900 mb-4">Precision Tools for Modern Hoteliers</h2>
            <p className="text-slate-600 text-lg">Everything you need to manage your property with confidence and class.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: "Guest Profiling",
                desc: "Deep insights into guest preferences, history, and loyalty status to personalize every stay."
              },
              {
                icon: MessageSquare,
                title: "Unified Comms",
                desc: "Manage email, WhatsApp, and calls from a single, elegant interface."
              },
              {
                icon: BarChart3,
                title: "Revenue Analytics",
                desc: "Real-time dashboards providing crystal-clear visibility into your property's financial health."
              },
              {
                icon: Shield,
                title: "Enterprise Security",
                desc: "Bank-grade data protection with granular role-based access controls."
              },
              {
                icon: Zap,
                title: "Smart Automation",
                desc: "Automate routine tasks and follow-ups so your team can focus on the guest."
              },
              {
                icon: Globe,
                title: "Multi-Property",
                desc: "Seamlessly manage entire portfolios from a centralized command center."
              }
            ].map((feature, i) => (
              <div key={i} className="group p-8 border border-slate-100 rounded-sm hover:border-amber-200 hover:shadow-lg hover:shadow-amber-900/5 transition-all duration-300 bg-white">
                <div className="w-12 h-12 bg-slate-50 rounded-sm flex items-center justify-center mb-6 group-hover:bg-amber-50 transition-colors">
                  <feature.icon className="w-6 h-6 text-slate-700 group-hover:text-amber-600 transition-colors" />
                </div>
                <h3 className="font-serif text-xl font-medium text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section id="testimonials" className="py-24 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] opacity-10 bg-cover bg-center"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-10">
            <Star className="w-8 h-8 text-amber-500 mx-auto fill-amber-500" />
            <blockquote className="font-serif text-3xl md:text-5xl leading-tight">
              "{HOTEL_BRAND} has completely transformed our guest relations. It's not just software; it's the backbone of our personalized service."
            </blockquote>
            <div className="space-y-2">
              <div className="font-medium text-lg">Elena Rodriguez</div>
              <div className="text-slate-400 text-sm uppercase tracking-widest">General Manager, The Grand Hotel</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="bg-amber-50 rounded-2xl p-12 md:p-20 text-center border border-amber-100">
            <h2 className="font-serif text-4xl md:text-5xl font-medium text-slate-900 mb-6">Ready to Experience the Difference?</h2>
            <p className="text-slate-600 text-lg mb-10 max-w-2xl mx-auto">Join the world's most prestigious hotels in redefining hospitality management.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button
                className="h-12 px-8 bg-slate-900 text-white hover:bg-slate-800 rounded-sm shadow-xl shadow-slate-900/10"
                onClick={onGetStarted}
              >
                Get Started Now
              </Button>
              <Button
                variant="outline"
                className="h-12 px-8 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 rounded-sm"
              >
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-12">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 bg-slate-900 rounded-sm flex items-center justify-center">
                  <span className="text-amber-400 font-serif font-bold text-sm">M</span>
                </div>
                <span className="font-serif text-lg font-bold text-slate-900">
                  {HOTEL_BRAND}
                </span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                Empowering the world's finest hotels to deliver unforgettable guest experiences.
              </p>
            </div>

            {[
              { title: "Product", links: ["Features", "Integrations", "Pricing", "API"] },
              { title: "Company", links: ["About Us", "Careers", "Blog", "Press"] },
              { title: "Legal", links: ["Privacy", "Terms", "Security", "Status"] },
            ].map((column, i) => (
              <div key={i}>
                <h4 className="font-medium text-slate-900 mb-6">{column.title}</h4>
                <ul className="space-y-4">
                  {column.links.map((link, j) => (
                    <li key={j}>
                      <a href="#" className="text-slate-500 hover:text-amber-600 text-sm transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-slate-400 text-xs">
              &copy; {new Date().getFullYear()} {HOTEL_BRAND}. All rights reserved.
            </div>
            <div className="text-slate-400 text-xs">
              Powered by MAG Ventures
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
