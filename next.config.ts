import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  poweredByHeader: false,
  serverExternalPackages: [],
  // 5.4: sent with every page, file and API answer
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // a photo is only ever read as the image type it was saved with
          { key: "X-Content-Type-Options", value: "nosniff" },
          // no other site may show the app inside a frame
          { key: "X-Frame-Options", value: "DENY" },
          // an invite link (/signup?code=…) is never passed on to another site
          { key: "Referrer-Policy", value: "same-origin" },
          // once reached over HTTPS, a browser keeps using HTTPS for a year
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
};
export default nextConfig;
