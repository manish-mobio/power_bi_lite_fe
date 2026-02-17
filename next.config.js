/** @type {import('next').NextConfig} */

module.exports = {
  reactStrictMode: true,
  transpilePackages: [
    '@rc-component/util',
    'antd',
    '@ant-design',
    'rc-util',
    'rc-pagination',
    'rc-picker',
    'rc-notification',
    'rc-tooltip',
    "@babel/runtime",
    "@ant-design/icons",
    "@ant-design/icons-svg",
    "rc-tree",
    "rc-table",
  ],
  images: {
    domains: ['localhost', 'picsum.photos'],
  },
  devIndicators: {
    buildActivity: false,
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/bi-dashboard',
        permanent: true,
      },
    ]
  },
}
