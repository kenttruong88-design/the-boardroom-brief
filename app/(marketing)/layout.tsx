import Navigation from "@/app/components/Navigation";
import Footer from "@/app/components/Footer";
import TickerBar from "@/app/components/TickerBar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TickerBar />
      <Navigation />
      <main>{children}</main>
      <Footer />
    </>
  );
}
