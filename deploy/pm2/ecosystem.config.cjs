module.exports = {
  apps: [
    {
      name: 'sales-api',
      cwd: './services/sales',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
    {
      name: 'crm-api',
      cwd: './services/crm',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        CRM_PORT: 4100,
      },
    },
    {
      name: 'tickets-api',
      cwd: './services/tickets',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        TICKETS_PORT: 4300,
      },
    },
    {
      name: 'finance-api',
      cwd: './services/finance',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        FINANCE_PORT: 4400,
      },
    },
    {
      name: 'hrms-api',
      cwd: './services/hrms',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
    },
  ],
};
