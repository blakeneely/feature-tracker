import type { Metadata } from 'next';
import { Archivo_Narrow, IBM_Plex_Mono, Source_Sans_3 } from 'next/font/google';
import './globals.css';

const display = Archivo_Narrow({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

const body = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-body',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Feature Tracker',
  description: 'A personal Kanban board',
};

// Applies a stored theme override before first paint so a forced theme never
// flashes the system one. No stored value = no attribute = follow the system.
const themeInit = `try{var t=localStorage.getItem('feature-tracker:theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
      </body>
    </html>
  );
}
