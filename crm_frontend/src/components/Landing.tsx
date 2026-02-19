import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HOTEL_BRAND } from "@/config/hotel";
import { 
  ArrowRight, 
  CheckCircle2, 
  Users, 
  TrendingUp, 
  Shield, 
  Zap, 
  BarChart3,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  FileText,
  Star,
  Building2,
  Clock,
  Target
} from "lucide-react";
interface LandingProps {
  onGetStarted: () => void;
}

const Landing = ({ onGetStarted }: LandingProps) => {
  const features = [
    {
      icon: Users,
      title: "Guest Relationship Management",
      description: "Comprehensive guest profiles with interaction history, preferences, and loyalty status tracking.",
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600"
    },
    {
      icon: Phone,
      title: "Unified Communication Hub",
      description: "Seamlessly manage calls, emails, SMS, and WhatsApp from a single interface.",
      color: "from-emerald-500 to-teal-500",
      bgColor: "bg-emerald-50",
      iconColor: "text-emerald-600"
    },
    {
      icon: TrendingUp,
      title: "Lead Management & Conversion",
      description: "Track leads through custom workflows, assign intelligently, and convert prospects into guests.",
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600"
    },
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      description: "Monitor performance metrics, revenue trends, and team productivity with live dashboards.",
      color: "from-orange-500 to-red-500",
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600"
    },
    {
      icon: Shield,
      title: "Role-Based Access Control",
      description: "Granular permissions ensuring each team member sees only what they need.",
      color: "from-indigo-500 to-blue-500",
      bgColor: "bg-indigo-50",
      iconColor: "text-indigo-600"
    },
    {
      icon: Zap,
      title: "Automated Workflows",
      description: "Streamline operations with automated follow-ups, task assignments, and notifications.",
      color: "from-yellow-500 to-amber-500",
      bgColor: "bg-yellow-50",
      iconColor: "text-yellow-600"
    },
    {
      icon: Calendar,
      title: "Smart Scheduling",
      description: "Manage follow-ups, appointments, and team availability with intelligent scheduling.",
      color: "from-rose-500 to-pink-500",
      bgColor: "bg-rose-50",
      iconColor: "text-rose-600"
    },
    {
      icon: FileText,
      title: "Knowledge Base",
      description: "Centralized repository of property information, templates, and best practices.",
      color: "from-violet-500 to-purple-500",
      bgColor: "bg-violet-50",
      iconColor: "text-violet-600"
    }
  ];

  const benefits = [
    {
      title: "Increase Conversion Rates",
      value: "40%",
      description: "Better lead tracking and follow-up management"
    },
    {
      title: "Reduce Response Time",
      value: "60%",
      description: "Unified communication channels for faster responses"
    },
    {
      title: "Improve Guest Satisfaction",
      value: "85%",
      description: "Personalized service through comprehensive guest profiles"
    }
  ];

  const testimonials = [
    {
      name: "Rajesh Kumar",
      role: "General Manager",
      property: HOTEL_BRAND,
      quote: `${HOTEL_BRAND} has transformed how we manage guest relationships. The unified dashboard gives us complete visibility.`,
      rating: 5
    },
    {
      name: "Priya Sharma",
      role: "Sales Head",
      property: HOTEL_BRAND,
      quote: "Lead conversion has improved dramatically. The workflow automation saves us hours every day.",
      rating: 5
    },
    {
      name: "Harleen Mehta",
      role: "Call Center Agent",
      property: HOTEL_BRAND,
      quote: "Everything I need is in one place. The guest profiles help me provide personalized service instantly.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-cyan-500 p-2 rounded-sm">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <span className="font-heading text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent tracking-tight">
                {HOTEL_BRAND}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                className="text-slate-600 hover:text-blue-600 hover:bg-blue-50/50"
                onClick={onGetStarted}
              >
                Sign In
              </Button>
              <Button
                className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 rounded-sm px-8 py-6 font-medium tracking-wide shadow-lg shadow-blue-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30"
                onClick={onGetStarted}
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white to-cyan-50/30"></div>
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Badge className="bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border-blue-200 rounded-full px-4 py-1.5 text-xs font-bold tracking-wider uppercase shadow-sm">
                ✨ Hotel CRM Platform
              </Badge>
              <h1 className="font-heading text-5xl md:text-6xl font-bold tracking-tight leading-tight">
                <span className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent">
                  The Cockpit for
                </span>
                <span className="block bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  Concierges
                </span>
              </h1>
              <p className="text-xl text-slate-700 font-body leading-relaxed max-w-xl">
                A fusion of high-end hospitality elegance and military-grade operational efficiency. 
                Manage guests, leads, and communications from one powerful platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 rounded-sm px-8 py-6 font-medium tracking-wide shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/40"
                  onClick={onGetStarted}
                  size="lg"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  className="border-2 border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 rounded-sm px-8 py-6 font-medium tracking-wide text-slate-700"
                  size="lg"
                >
                  Watch Demo
                </Button>
              </div>
              <div className="flex items-center gap-8 pt-4">
                <div className="text-center">
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent font-heading">500+</div>
                  <div className="text-sm text-slate-600 font-body font-medium">Hotels Trust Us</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent font-heading">50K+</div>
                  <div className="text-sm text-slate-600 font-body font-medium">Guests Managed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent font-heading">99.9%</div>
                  <div className="text-sm text-slate-600 font-body font-medium">Uptime</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg blur opacity-20"></div>
              <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-8 shadow-2xl">
                <div className="bg-white rounded-lg p-6 space-y-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500 font-body mb-1">
                        Guest Profile
                      </div>
                      <div className="font-heading text-2xl font-bold text-slate-900">Priya Sharma</div>
                    </div>
                    <Badge className="bg-gradient-to-r from-amber-400 to-amber-600 text-white border-0 rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase shadow-sm">
                      Gold Member
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div>
                      <div className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500 font-body mb-1">
                        Total Stays
                      </div>
                      <div className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent font-heading">8</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500 font-body mb-1">
                        Last Visit
                      </div>
                      <div className="text-xl font-bold text-slate-900 font-heading">May 2024</div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <div className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500 font-body mb-2">
                      Preferences
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 rounded-sm text-xs">Ocean View</Badge>
                      <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200 rounded-sm text-xs">Late Checkout</Badge>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 rounded-sm text-xs">Quiet Room</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="bg-blue-50 text-blue-700 border-blue-200 rounded-full px-4 py-1 text-xs font-bold tracking-wider uppercase mb-4 inline-block">
              Features
            </Badge>
            <h2 className="font-heading text-4xl md:text-5xl font-bold tracking-tight mb-4">
              <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Everything You Need
              </span>
              <span className="block bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                to Excel
              </span>
            </h2>
            <p className="text-lg text-slate-600 font-body max-w-2xl mx-auto">
              Powerful features designed for modern hotel operations
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="bg-white border-2 border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 rounded-lg group cursor-pointer"
                >
                  <CardContent className="p-6">
                    <div className={`${feature.bgColor} w-14 h-14 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                      <Icon className={`h-7 w-7 ${feature.iconColor}`} />
                    </div>
                    <h3 className="font-heading text-lg font-bold text-slate-900 mb-2 tracking-tight group-hover:text-blue-600 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-slate-600 font-body text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 px-6 bg-gradient-to-br from-blue-50 via-cyan-50/50 to-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200 rounded-full px-4 py-1 text-xs font-bold tracking-wider uppercase mb-4 inline-block">
              Results
            </Badge>
            <h2 className="font-heading text-4xl md:text-5xl font-bold tracking-tight mb-4">
              <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Measurable
              </span>
              <span className="block bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Results
              </span>
            </h2>
            <p className="text-lg text-slate-600 font-body max-w-2xl mx-auto">
              See the impact on your operations
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => {
              const colors = [
                "from-blue-600 to-cyan-600",
                "from-emerald-500 to-teal-600",
                "from-purple-600 to-pink-600"
              ];
              const bgColors = [
                "bg-blue-50",
                "bg-emerald-50",
                "bg-purple-50"
              ];
              return (
                <Card
                  key={index}
                  className={`${bgColors[index]} border-2 border-transparent hover:border-blue-200 rounded-lg text-center shadow-lg hover:shadow-xl transition-all duration-300`}
                >
                  <CardContent className="p-8">
                    <div className={`text-6xl font-bold bg-gradient-to-r ${colors[index]} bg-clip-text text-transparent font-heading mb-3`}>
                      {benefit.value}
                    </div>
                    <h3 className="font-heading text-xl font-bold text-slate-900 mb-2 tracking-tight">
                      {benefit.title}
                    </h3>
                    <p className="text-slate-600 font-body text-sm">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 px-6 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="bg-purple-50 text-purple-700 border-purple-200 rounded-full px-4 py-1 text-xs font-bold tracking-wider uppercase mb-4 inline-block">
              Testimonials
            </Badge>
            <h2 className="font-heading text-4xl md:text-5xl font-bold tracking-tight mb-4">
              <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Trusted by
              </span>
              <span className="block bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Hotel Professionals
              </span>
            </h2>
            <p className="text-lg text-slate-600 font-body max-w-2xl mx-auto">
              See what our users are saying
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card
                key={index}
                className="bg-white border-2 border-slate-100 shadow-md hover:shadow-xl hover:border-blue-200 transition-all duration-300 rounded-lg group"
              >
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-700 font-body mb-6 leading-relaxed text-base">
                    "{testimonial.quote}"
                  </p>
                  <div className="border-t border-slate-100 pt-4">
                    <div className="font-heading font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-slate-500 font-body">
                      {testimonial.role} • {testimonial.property}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-cyan-600 to-blue-700"></div>
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        ></div>
        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">
            Ready to Transform Your Hotel Operations?
          </h2>
          <p className="text-xl text-blue-50 font-body mb-8 max-w-2xl mx-auto">
            Join hundreds of hotels already using {HOTEL_BRAND} to deliver exceptional guest experiences.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              className="bg-white text-blue-600 hover:bg-blue-50 rounded-lg px-8 py-6 font-medium tracking-wide shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 font-bold"
              onClick={onGetStarted}
              size="lg"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              className="border-2 border-white/30 text-white hover:bg-white/10 hover:border-white rounded-lg px-8 py-6 font-medium tracking-wide backdrop-blur-sm"
              size="lg"
            >
              Schedule Demo
            </Button>
          </div>
          <p className="text-sm text-blue-100 font-body mt-6">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-b from-slate-50 to-white border-t border-slate-200 py-12 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gradient-to-br from-blue-600 to-cyan-500 p-2 rounded-sm">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <span className="font-heading text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent tracking-tight">
                  {HOTEL_BRAND}
                </span>
              </div>
              <p className="text-slate-600 font-body text-sm">
                The professional CRM platform for modern hotels.
              </p>
            </div>
            <div>
              <h4 className="font-heading font-bold text-slate-900 mb-4 tracking-tight">
                Product
              </h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-600 hover:text-slate-900 font-body text-sm">Features</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 font-body text-sm">Pricing</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 font-body text-sm">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-bold text-slate-900 mb-4 tracking-tight">
                Company
              </h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-600 hover:text-slate-900 font-body text-sm">About</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 font-body text-sm">Blog</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 font-body text-sm">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-bold text-slate-900 mb-4 tracking-tight">
                Support
              </h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-600 hover:text-slate-900 font-body text-sm">Documentation</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 font-body text-sm">Help Center</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 font-body text-sm">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-8 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-slate-500 font-body text-sm">
              © 2024 {HOTEL_BRAND}. All rights reserved.
            </p>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <a href="#" className="text-slate-500 hover:text-slate-900 font-body text-sm">Privacy</a>
              <a href="#" className="text-slate-500 hover:text-slate-900 font-body text-sm">Terms</a>
              <a href="#" className="text-slate-500 hover:text-slate-900 font-body text-sm">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

