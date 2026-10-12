import { AppProvider } from "./context/AppContext";
import { CallToAction } from "./components/CallToAction";
import { DemoDialog } from "./components/DemoDialog";
import { FAQ } from "./components/FAQ";
import { Features } from "./components/Features";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { LogoCloud } from "./components/LogoCloud";
import { Navbar } from "./components/Navbar";
import { Pricing } from "./components/Pricing";
import { Testimonial } from "./components/Testimonial";
import { Toaster } from "./components/Toaster";

export default function App() {
  return (
    <AppProvider>
      <div id="sorrel-root" className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main>
          <Hero />
          <LogoCloud />
          <Features />
          <Pricing />
          <Testimonial />
          <FAQ />
          <CallToAction />
        </main>
        <Footer />
        <DemoDialog />
        <Toaster />
      </div>
    </AppProvider>
  );
}
