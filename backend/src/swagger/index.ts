import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';

// Assembles the OpenAPI document from the JSDoc annotations on each route. The
// glob covers both TypeScript sources (development) and compiled JavaScript
// (production build), so docs work in either mode.
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'InvoiceFi API',
      version: '0.1.0',
      description:
        'AI powered tokenized invoice financing platform on Stellar Soroban. Businesses tokenize verified invoices, investors fund them, and settlement pays investors on repayment.',
    },
    servers: [{ url: '/', description: 'Current host' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      { name: 'System' },
      { name: 'Auth' },
      { name: 'Invoice' },
      { name: 'Marketplace' },
      { name: 'Portfolio' },
      { name: 'Admin' },
      { name: 'AI' },
    ],
  },
  apis: [path.resolve(__dirname, '../routes/*.js'), path.resolve(__dirname, '../routes/*.ts')],
};

export const openapiSpec = swaggerJsdoc(options);
