module.exports = {
  apps: [
    {
      name: "veil-backend",
      script: "./app.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
      combine_logs: true,
      merge_logs: true,
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
    },
  ],
};
