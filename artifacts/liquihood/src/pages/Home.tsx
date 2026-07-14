import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BeamDivider } from "@/components/ui/BeamDivider";
import { Hero } from "@/components/sections/Hero";
import { ProblemSolution } from "@/components/sections/ProblemSolution";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Features } from "@/components/sections/Features";
import { Architecture } from "@/components/sections/Architecture";
import { Security } from "@/components/sections/Security";
import { RobinhoodChain } from "@/components/sections/RobinhoodChain";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";

export default function Home() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#000000", color: "#EDEDED" }}
    >
      <Navbar />
      <main className="flex-1">
        <Hero />
        <BeamDivider />
        <ProblemSolution />
        <BeamDivider delay />
        <HowItWorks />
        <BeamDivider />
        <Features />
        <BeamDivider delay />
        <Architecture />
        <BeamDivider />
        <Security />
        <BeamDivider delay />
        <RobinhoodChain />
        <BeamDivider />
        <FAQ />
        <BeamDivider delay />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
