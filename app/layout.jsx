import "./globals.css";

export const metadata = {
  title: "VaxAgent — Cancer Vaccine Design Co-pilot",
  description: "AI agent for personalized neoantigen cancer vaccine design. Powered by NVIDIA Nemotron.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
