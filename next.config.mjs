/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "bcryptjs"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
}

export default nextConfig
