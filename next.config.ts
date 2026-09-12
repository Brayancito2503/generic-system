import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  /* Fix Turbopack root detection: el repo vive dentro de C:\Users\braya (OneDrive)
     y Next resolvía la raíz fuera del proyecto, corrompiendo el caché de dev. */
  turbopack: {
    root: __dirname,
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);