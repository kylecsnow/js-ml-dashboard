/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: 'http://127.0.0.1:8000/api/:path*' // Redirect to backend  -->  needs to be `127.0.0.1` for macOS instead of `localhost`...?
        //   destination: 'http://localhost:8000/api/dataset-generator' // Redirect to backend  -->  needs to be `127.0.0.1` for macOS instead of `localhost`...?
        }
      ]
    },
    typescript: {
      ignoreBuildErrors: true,
    },
    assetPrefix: "/",  // --> needs to be `./` for Ubuntu...?
    // assetPrefix: "./",  // --> needs to be `./` for Ubuntu...?
    eslint: {
      dirs: ['src'],
    },
  
    reactStrictMode: true,
    swcMinify: true,
  
    // Uncoment to add domain whitelist
    // images: {
    //   remotePatterns: [
    //     {
    //       protocol: 'https',
    //       hostname: 'res.cloudinary.com',
    //     },
    //   ]
    // },
  
    webpack: (config, { isServer }) => {
      if (!isServer) {
        config.resolve.fallback = {
          ...config.resolve.fallback,
          fs: false,
          net: false,
          tls: false,
        }
      }
  
      // Grab the existing rule that handles SVG imports
      const fileLoaderRule = config.module.rules.find((rule) =>
        rule.test?.test?.('.svg')
      );
  
      config.module.rules.push(
        // Reapply the existing rule, but only for svg imports ending in ?url
        {
          ...fileLoaderRule,
          test: /\.svg$/i,
          resourceQuery: /url/, // *.svg?url
        },
        // Convert all other *.svg imports to React components
        {
          test: /\.svg$/i,
          issuer: { not: /\.(css|scss|sass)$/ },
          resourceQuery: { not: /url/ }, // exclude if *.svg?url
          loader: '@svgr/webpack',
          options: {
            dimensions: false,
            titleProp: true,
          },
        }
      );
  
      // Modify the file loader rule to ignore *.svg, since we have it handled now.
      fileLoaderRule.exclude = /\.svg$/i;
  
      return config;
    },
  };
  
  export default nextConfig;
  