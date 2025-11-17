import type { Metadata } from "next";
import { cssVariables } from "./designSystem";

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
        <style
          dangerouslySetInnerHTML={{
            __html: `
          :root {
            ${cssVariables}
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 0;
            background-color: var(--color-background);
            color: var(--color-text-primary);
            font-family: var(--font-mono);
            font-size: var(--font-size-sm);
            line-height: var(--line-height-normal);
          }

          ::selection {
            background-color: var(--color-accent);
            color: var(--color-background);
          }

          ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }

          ::-webkit-scrollbar-track {
            background: var(--color-surface);
          }

          ::-webkit-scrollbar-thumb {
            background: var(--color-border);
          }

          ::-webkit-scrollbar-thumb:hover {
            background: var(--color-divider);
          }
        `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
