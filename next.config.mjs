// Статический экспорт — сайт можно разместить на GitHub Pages или любом статическом хостинге.
// NEXT_PUBLIC_BASE_PATH задаётся при сборке для GitHub Pages (адрес вида https://user.github.io/tutor-cabinet/).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
