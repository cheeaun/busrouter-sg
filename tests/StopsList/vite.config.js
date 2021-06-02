// Reference: https://github.com/preactjs/preset-vite/blob/main/src/index.ts
export default {
  plugins: [
    {
      name: 'preact:config',
      config() {
        return {
          esbuild: {
            jsxFactory: 'h',
            jsxFragment: 'Fragment',
          },
          resolve: {
            alias: {
              'react-dom/test-utils': 'preact/test-utils',
              'react-dom': 'preact/compat',
              react: 'preact/compat',
            },
          },
        };
      },
    },
  ],
};
