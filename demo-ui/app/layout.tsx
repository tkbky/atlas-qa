import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ATLAS Demo UI",
  description: "Live visualization of ATLAS agent collaboration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --terminal-bg: #000;
            --terminal-bg-secondary: #0a0a0a;
            --terminal-bg-tertiary: #1a1a1a;
            --terminal-green: #00ff00;
            --terminal-amber: #ffb000;
            --terminal-red: #ff4444;
            --terminal-gray: #888;
            --terminal-gray-dark: #555;
            --terminal-border: #333;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 0;
            background-color: var(--terminal-bg);
            color: var(--terminal-green);
            font-family: Consolas, Monaco, 'Courier New', monospace;
          }

          ::selection {
            background-color: var(--terminal-green);
            color: var(--terminal-bg);
          }

          ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }

          ::-webkit-scrollbar-track {
            background: var(--terminal-bg-secondary);
          }

          ::-webkit-scrollbar-thumb {
            background: var(--terminal-border);
          }

          ::-webkit-scrollbar-thumb:hover {
            background: var(--terminal-gray);
          }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
